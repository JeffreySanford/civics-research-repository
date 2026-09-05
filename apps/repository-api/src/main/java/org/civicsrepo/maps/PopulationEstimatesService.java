package org.civicsrepo.maps;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.net.URI;
import java.nio.charset.Charset;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVParser;
import org.apache.commons.csv.CSVRecord;
import org.apache.commons.csv.DuplicateHeaderMode;
import org.civicsrepo.generated.dto.CensusAreaBoundary;
import org.civicsrepo.generated.dto.PopulationEstimateCountyValue;
import org.civicsrepo.generated.dto.PopulationEstimateMeasure;
import org.civicsrepo.generated.dto.PopulationEstimatesChoropleth;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

/**
 * Serves Census Population Estimates Program Vintage 2025 county thematic values.
 *
 * <p>The PEP file is the value authority. Census TIGERweb remains the geometry authority.
 * Values and polygons are joined only by stable five-digit county GEOID; neither source is used
 * to manufacture missing evidence from the other.
 */
@Service
public class PopulationEstimatesService {
    static final int VINTAGE = 2025;

    private static final String CSV_RESOURCE =
            "/maps/population-estimates/co-est2025-alldata.csv";
    private static final String METADATA_RESOURCE =
            "/maps/population-estimates/source.json";

    private static final List<Integer> EXPECTED_POPULATION_YEARS =
            List.of(2020, 2021, 2022, 2023, 2024, 2025);
    private static final List<Integer> EXPECTED_CHANGE_YEARS =
            List.of(2021, 2022, 2023, 2024, 2025);

    private final CensusAreaBoundaryService censusAreaBoundaryService;
    private final AdministrativeGeometryService administrativeGeometryService;
    private final ObjectMapper objectMapper = new ObjectMapper();

    private final byte[] csvOverride;
    private final byte[] metadataOverride;

    private volatile SourceDataset cachedDataset;

    @Autowired
    public PopulationEstimatesService(
            CensusAreaBoundaryService censusAreaBoundaryService,
            AdministrativeGeometryService administrativeGeometryService) {
        this(
                censusAreaBoundaryService,
                administrativeGeometryService,
                null,
                null);
    }

    PopulationEstimatesService(
            CensusAreaBoundaryService censusAreaBoundaryService,
            AdministrativeGeometryService administrativeGeometryService,
            byte[] csvOverride,
            byte[] metadataOverride) {
        this.censusAreaBoundaryService = censusAreaBoundaryService;
        this.administrativeGeometryService = administrativeGeometryService;
        this.csvOverride = csvOverride;
        this.metadataOverride = metadataOverride;
    }

    public boolean supportsGeography(String geography) {
        if (geography == null || geography.isBlank()) {
            return false;
        }

        return censusAreaBoundaryService.listBoundaries().stream()
                .filter(
                        boundary ->
                                boundary
                                        .getGeography()
                                        .equalsIgnoreCase(geography))
                .map(CensusAreaBoundary::getGeography)
                .map(PopulationEstimatesService::normalize)
                .anyMatch(
                        normalized ->
                                sourceDataset()
                                        .countiesByStateName()
                                        .containsKey(normalized));
    }

    public PopulationEstimatesChoropleth findChoropleth(
            String geography,
            PopulationEstimateMeasure measure,
            int year) {
        CensusAreaBoundary boundary = resolveBoundary(geography);
        SourceDataset dataset = sourceDataset();

        String stateKey = normalize(boundary.getGeography());
        List<CountySeries> counties =
                dataset.countiesByStateName().get(stateKey);

        if (counties == null || counties.isEmpty()) {
            throw new IllegalArgumentException(
                    "No retained Census Population Estimates Program Vintage "
                            + VINTAGE
                            + " county values are available for "
                            + boundary.getGeography()
                            + ".");
        }

        validateMeasureYear(dataset.metadata(), measure, year);

        String stateFips = dataset.stateFipsByName().get(stateKey);
        if (stateFips == null) {
            throw new IllegalStateException(
                    "Population Estimates source did not retain a state FIPS for "
                            + boundary.getGeography()
                            + ".");
        }

        AdministrativeGeometryService.AdministrativeGeometry geometry =
                administrativeGeometryService.countiesForState(
                        stateFips,
                        VINTAGE);

        Map<String, JsonNode> geometryByGeoid =
                geometryByGeoid(geometry.geoJson());

        Set<String> valueGeoids = new LinkedHashSet<>();
        for (CountySeries county : counties) {
            valueGeoids.add(county.geoid());
        }

        Set<String> missingGeometry = new LinkedHashSet<>(valueGeoids);
        missingGeometry.removeAll(geometryByGeoid.keySet());

        if (!missingGeometry.isEmpty()) {
            throw new IllegalStateException(
                    "No authoritative Census county geometry was returned for retained "
                            + "Population Estimates GEOID "
                            + missingGeometry.iterator().next()
                            + ".");
        }

        Set<String> missingValues =
                new LinkedHashSet<>(geometryByGeoid.keySet());
        missingValues.removeAll(valueGeoids);

        if (!missingValues.isEmpty()) {
            throw new IllegalStateException(
                    "Authoritative Census county geometry GEOID "
                            + missingValues.iterator().next()
                            + " has no retained Population Estimates value.");
        }

        Integer priorYear =
                measure == PopulationEstimateMeasure.POPULATION
                        ? null
                        : year - 1;

        String measureLabel = measureLabel(measure);
        String units = units(measure);

        ObjectNode geoJson = objectMapper.createObjectNode();
        geoJson.put("type", "FeatureCollection");
        geoJson.put("sourceVintage", dataset.metadata().vintage());
        geoJson.put("geometryVintage", geometry.vintage());
        geoJson.put("measure", measure.name());
        geoJson.put("year", year);
        if (priorYear != null) {
            geoJson.put("priorYear", priorYear);
        }
        ArrayNode features = geoJson.putArray("features");

        List<PopulationEstimateCountyValue> values =
                new ArrayList<>();

        for (CountySeries county : counties) {
            long population = county.population(year);
            Long priorPopulation =
                    priorYear == null
                            ? null
                            : county.population(priorYear);

            double value =
                    selectedValue(
                            county,
                            measure,
                            year,
                            priorYear);

            PopulationEstimateCountyValue countyValue =
                    new PopulationEstimateCountyValue(
                            county.geoid(),
                            county.countyName(),
                            value,
                            population);

            if (priorPopulation != null) {
                countyValue.priorPopulation(priorPopulation);
            }

            values.add(countyValue);

            ObjectNode feature =
                    geometryByGeoid
                            .get(county.geoid())
                            .deepCopy();
            ObjectNode properties =
                    feature.withObject("properties");

            properties.put("fips", county.geoid());
            properties.put("name", county.countyName());
            properties.put("value", value);
            properties.put("population", population);
            properties.put("measure", measure.name());
            properties.put("year", year);

            if (priorYear != null && priorPopulation != null) {
                properties.put("priorYear", priorYear);
                properties.put(
                        "priorPopulation",
                        priorPopulation);
            }

            features.add(feature);
        }

        values.sort(
                Comparator.comparing(
                        PopulationEstimateCountyValue::getName));

        PopulationEstimatesChoropleth response =
                new PopulationEstimatesChoropleth(
                        dataset.metadata().source(),
                        dataset.metadata().sourceUrl(),
                        dataset.metadata().source(),
                        boundary.getGeography(),
                        dataset.metadata().vintage(),
                        dataset.metadata().sha256(),
                        dataset.metadata().capturedAt(),
                        geometry.vintage(),
                        geometry.sourceUrl(),
                        geometry.attribution(),
                        measure,
                        measureLabel,
                        units,
                        year,
                        dataset.metadata().populationYears(),
                        dataset.metadata().changeYears(),
                        objectMapper.convertValue(
                                geoJson,
                                Map.class),
                        List.copyOf(values));

        if (priorYear != null) {
            response.priorYear(priorYear);
        }

        return response;
    }

    private void validateMeasureYear(
            SourceMetadata metadata,
            PopulationEstimateMeasure measure,
            int year) {
        if (measure == null) {
            throw new InvalidQueryException(
                    "Population estimate measure is required.");
        }

        List<Integer> supported =
                measure == PopulationEstimateMeasure.POPULATION
                        ? metadata.populationYears()
                        : metadata.changeYears();

        if (!supported.contains(year)) {
            throw new InvalidQueryException(
                    "Year "
                            + year
                            + " is not supported for population estimate measure "
                            + measure
                            + ".");
        }
    }

    private double selectedValue(
            CountySeries county,
            PopulationEstimateMeasure measure,
            int year,
            Integer priorYear) {
        long current = county.population(year);

        return switch (measure) {
            case POPULATION -> (double) current;

            case ANNUAL_CHANGE -> {
                long prior = county.population(priorYear);
                yield (double) (current - prior);
            }

            case ANNUAL_GROWTH_RATE -> {
                long prior = county.population(priorYear);
                if (prior == 0L) {
                    throw new IllegalStateException(
                            "Annual growth rate is undefined because prior-year population is zero for GEOID "
                                    + county.geoid()
                                    + ".");
                }
                yield ((current - prior) * 100.0d) / prior;
            }
        };
    }

    private String measureLabel(
            PopulationEstimateMeasure measure) {
        return switch (measure) {
            case POPULATION -> "Resident population estimate";
            case ANNUAL_CHANGE -> "Annual population change";
            case ANNUAL_GROWTH_RATE ->
                    "Annual population growth rate";
        };
    }

    private String units(PopulationEstimateMeasure measure) {
        return switch (measure) {
            case POPULATION, ANNUAL_CHANGE -> "people";
            case ANNUAL_GROWTH_RATE -> "percent";
        };
    }

    private Map<String, JsonNode> geometryByGeoid(
            ObjectNode geoJson) {
        Map<String, JsonNode> result =
                new LinkedHashMap<>();

        for (JsonNode feature : geoJson.path("features")) {
            String geoid =
                    feature.path("properties")
                            .path("GEOID")
                            .asText();

            if (!geoid.matches("\\d{5}")) {
                throw new IllegalStateException(
                        "Authoritative Census county geometry returned an invalid GEOID.");
            }

            if (result.putIfAbsent(geoid, feature) != null) {
                throw new IllegalStateException(
                        "Authoritative Census county geometry returned duplicate GEOID "
                                + geoid
                                + ".");
            }
        }

        return result;
    }

    private SourceDataset sourceDataset() {
        SourceDataset existing = cachedDataset;
        if (existing != null) {
            return existing;
        }

        synchronized (this) {
            existing = cachedDataset;
            if (existing != null) {
                return existing;
            }

            SourceMetadata metadata =
                    readMetadata(
                            metadataOverride != null
                                    ? metadataOverride
                                    : readResourceBytes(
                                            METADATA_RESOURCE));

            byte[] csvBytes =
                    csvOverride != null
                            ? csvOverride
                            : readResourceBytes(CSV_RESOURCE);

            String actualSha = sha256(csvBytes);
            if (!actualSha.equals(metadata.sha256())) {
                throw new IllegalStateException(
                        "Pinned Population Estimates source checksum mismatch: expected "
                                + metadata.sha256()
                                + " but read "
                                + actualSha
                                + ".");
            }

            cachedDataset =
                    parseCsv(csvBytes, metadata);
            return cachedDataset;
        }
    }

    private SourceMetadata readMetadata(byte[] bytes) {
        final JsonNode root;

        try {
            root = objectMapper.readTree(bytes);
        } catch (IOException exception) {
            throw new IllegalStateException(
                    "Population Estimates source metadata could not be read.",
                    exception);
        }

        int vintage = root.path("vintage").asInt(-1);
        if (vintage != VINTAGE) {
            throw new IllegalStateException(
                    "Population Estimates source metadata must declare Vintage "
                            + VINTAGE
                            + ".");
        }

        List<Integer> populationYears =
                readIntegerList(
                        root,
                        "supportedPopulationYears");
        List<Integer> changeYears =
                readIntegerList(
                        root,
                        "supportedChangeYears");

        if (!populationYears.equals(
                        EXPECTED_POPULATION_YEARS)
                || !changeYears.equals(
                        EXPECTED_CHANGE_YEARS)) {
            throw new IllegalStateException(
                    "Population Estimates source metadata declares an unexpected year set.");
        }

        if (!root.path("annualChangeColumnsValidated")
                .asBoolean(false)) {
            throw new IllegalStateException(
                    "Population Estimates source metadata must record annual-change validation.");
        }

        return new SourceMetadata(
                requireMetadataText(root, "source"),
                URI.create(
                        requireMetadataText(
                                root,
                                "sourceUrl")),
                vintage,
                requireMetadataText(root, "sha256"),
                requireMetadataText(
                        root,
                        "sourceEncoding"),
                LocalDate.parse(
                        requireMetadataText(
                                root,
                                "capturedAt")),
                root.path("countyRows").asInt(-1),
                populationYears,
                changeYears);
    }

    private SourceDataset parseCsv(
            byte[] csvBytes,
            SourceMetadata metadata) {
        CSVFormat format =
                CSVFormat.DEFAULT
                        .builder()
                        .setHeader()
                        .setSkipHeaderRecord(true)
                        .setDuplicateHeaderMode(
                                DuplicateHeaderMode.DISALLOW)
                        .setAllowMissingColumnNames(false)
                        .get();

        Map<String, CountySeries> countiesByGeoid =
                new LinkedHashMap<>();
        Map<String, List<CountySeries>> countiesByStateName =
                new LinkedHashMap<>();
        Map<String, String> stateFipsByName =
                new LinkedHashMap<>();

        Charset charset =
                Charset.forName(metadata.sourceEncoding());

        try (InputStreamReader reader =
                        new InputStreamReader(
                                new ByteArrayInputStream(csvBytes),
                                charset);
                CSVParser parser = format.parse(reader)) {

            validateHeaders(parser.getHeaderMap().keySet());

            for (CSVRecord record : parser) {
                if (!"050".equals(record.get("SUMLEV").strip())) {
                    continue;
                }

                String stateFips =
                        requirePattern(
                                record,
                                "STATE",
                                "\\d{2}");
                String countyFips =
                        requirePattern(
                                record,
                                "COUNTY",
                                "\\d{3}");
                String geoid = stateFips + countyFips;

                String stateName =
                        requireCsvText(record, "STNAME");
                String countyName =
                        requireCsvText(record, "CTYNAME");

                Map<Integer, Long> populations =
                        new LinkedHashMap<>();

                for (int year :
                        EXPECTED_POPULATION_YEARS) {
                    long population =
                            parseLong(
                                    record,
                                    "POPESTIMATE"
                                            + year);

                    if (population < 0) {
                        throw new IllegalStateException(
                                "Population Estimates source contains a negative population for GEOID "
                                        + geoid
                                        + ", "
                                        + year
                                        + ".");
                    }

                    populations.put(year, population);
                }

                for (int year :
                        EXPECTED_CHANGE_YEARS) {
                    long publishedChange =
                            parseLong(
                                    record,
                                    "NPOPCHG" + year);

                    long derivedChange =
                            populations.get(year)
                                    - populations.get(
                                            year - 1);

                    if (publishedChange != derivedChange) {
                        throw new IllegalStateException(
                                "Population Estimates NPOPCHG validation failed for GEOID "
                                        + geoid
                                        + ", "
                                        + year
                                        + ".");
                    }
                }

                CountySeries county =
                        new CountySeries(
                                geoid,
                                stateFips,
                                stateName,
                                countyName,
                                Map.copyOf(populations));

                if (countiesByGeoid.putIfAbsent(
                                geoid,
                                county)
                        != null) {
                    throw new IllegalStateException(
                            "Population Estimates source contains duplicate county GEOID "
                                    + geoid
                                    + ".");
                }

                String stateKey = normalize(stateName);

                String priorStateFips =
                        stateFipsByName.putIfAbsent(
                                stateKey,
                                stateFips);

                if (priorStateFips != null
                        && !priorStateFips.equals(
                                stateFips)) {
                    throw new IllegalStateException(
                            "Population Estimates source maps state "
                                    + stateName
                                    + " to multiple state FIPS values.");
                }

                countiesByStateName
                        .computeIfAbsent(
                                stateKey,
                                ignored ->
                                        new ArrayList<>())
                        .add(county);
            }
        } catch (IOException exception) {
            throw new IllegalStateException(
                    "Population Estimates CSV could not be parsed.",
                    exception);
        }

        if (metadata.countyRows() <= 0
                || countiesByGeoid.size()
                        != metadata.countyRows()) {
            throw new IllegalStateException(
                    "Population Estimates county-row count mismatch: metadata="
                            + metadata.countyRows()
                            + ", parsed="
                            + countiesByGeoid.size()
                            + ".");
        }

        Map<String, List<CountySeries>> frozenStates =
                new LinkedHashMap<>();

        countiesByStateName.forEach(
                (key, counties) -> {
                    counties.sort(
                            Comparator.comparing(
                                    CountySeries::geoid));
                    frozenStates.put(
                            key,
                            List.copyOf(counties));
                });

        return new SourceDataset(
                metadata,
                Map.copyOf(countiesByGeoid),
                Map.copyOf(frozenStates),
                Map.copyOf(stateFipsByName));
    }

    private void validateHeaders(Set<String> headers) {
        Set<String> required =
                new LinkedHashSet<>(
                        List.of(
                                "SUMLEV",
                                "STATE",
                                "COUNTY",
                                "STNAME",
                                "CTYNAME"));

        for (int year :
                EXPECTED_POPULATION_YEARS) {
            required.add("POPESTIMATE" + year);
        }

        for (int year : EXPECTED_CHANGE_YEARS) {
            required.add("NPOPCHG" + year);
        }

        Set<String> missing =
                new LinkedHashSet<>(required);
        missing.removeAll(headers);

        if (!missing.isEmpty()) {
            throw new IllegalStateException(
                    "Population Estimates source is missing required columns: "
                            + missing
                            + ".");
        }
    }

    private CensusAreaBoundary resolveBoundary(
            String geography) {
        if (geography == null || geography.isBlank()) {
            throw new IllegalArgumentException(
                    "Geography is required.");
        }

        return censusAreaBoundaryService.listBoundaries()
                .stream()
                .filter(
                        boundary ->
                                boundary
                                        .getGeography()
                                        .equalsIgnoreCase(
                                                geography))
                .findFirst()
                .orElseThrow(
                        () ->
                                new IllegalArgumentException(
                                        "Unknown geography: "
                                                + geography));
    }

    private byte[] readResourceBytes(String resource) {
        try (InputStream input =
                getClass().getResourceAsStream(resource)) {
            if (input == null) {
                throw new IllegalStateException(
                        "Required Population Estimates resource is missing: "
                                + resource);
            }
            return input.readAllBytes();
        } catch (IOException exception) {
            throw new IllegalStateException(
                    "Population Estimates resource could not be read: "
                            + resource,
                    exception);
        }
    }

    private List<Integer> readIntegerList(
            JsonNode root,
            String property) {
        JsonNode values = root.path(property);
        if (!values.isArray()) {
            throw new IllegalStateException(
                    "Population Estimates source metadata property "
                            + property
                            + " must be an array.");
        }

        List<Integer> result = new ArrayList<>();
        values.forEach(
                value -> result.add(value.asInt()));
        return List.copyOf(result);
    }

    private static String requireMetadataText(
            JsonNode root,
            String property) {
        String value = root.path(property).asText();
        if (value == null || value.isBlank()) {
            throw new IllegalStateException(
                    "Population Estimates source metadata property "
                            + property
                            + " is required.");
        }
        return value.strip();
    }

    private static String requireCsvText(
            CSVRecord record,
            String column) {
        String value = record.get(column);
        if (value == null || value.isBlank()) {
            throw new IllegalStateException(
                    "Population Estimates source contains a blank "
                            + column
                            + " value.");
        }
        return value.strip();
    }

    private static String requirePattern(
            CSVRecord record,
            String column,
            String pattern) {
        String value =
                requireCsvText(record, column);

        if (!value.matches(pattern)) {
            throw new IllegalStateException(
                    "Population Estimates source contains invalid "
                            + column
                            + " value "
                            + value
                            + ".");
        }

        return value;
    }

    private static long parseLong(
            CSVRecord record,
            String column) {
        String value =
                requireCsvText(record, column);
        try {
            return Long.parseLong(value);
        } catch (NumberFormatException exception) {
            throw new IllegalStateException(
                    "Population Estimates source contains a nonnumeric "
                            + column
                            + " value "
                            + value
                            + ".",
                    exception);
        }
    }

    private static String sha256(byte[] bytes) {
        try {
            return HexFormat.of()
                    .formatHex(
                            MessageDigest
                                    .getInstance("SHA-256")
                                    .digest(bytes));
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException(
                    "SHA-256 is unavailable.",
                    exception);
        }
    }

    private static String normalize(String value) {
        return value.strip()
                .toLowerCase(Locale.ROOT);
    }

    static final class InvalidQueryException
            extends IllegalArgumentException {
        InvalidQueryException(String message) {
            super(message);
        }
    }

    private record SourceMetadata(
            String source,
            URI sourceUrl,
            int vintage,
            String sha256,
            String sourceEncoding,
            LocalDate capturedAt,
            int countyRows,
            List<Integer> populationYears,
            List<Integer> changeYears) {}

    private record SourceDataset(
            SourceMetadata metadata,
            Map<String, CountySeries> countiesByGeoid,
            Map<String, List<CountySeries>> countiesByStateName,
            Map<String, String> stateFipsByName) {}

    private record CountySeries(
            String geoid,
            String stateFips,
            String stateName,
            String countyName,
            Map<Integer, Long> populations) {
        long population(int year) {
            Long value = populations.get(year);
            if (value == null) {
                throw new IllegalStateException(
                        "Population Estimates source has no population for GEOID "
                                + geoid
                                + ", "
                                + year
                                + ".");
            }
            return value;
        }
    }
}
