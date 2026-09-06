package org.civicsrepo.maps;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStreamReader;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
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
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

/**
 * Serves the pinned 2023 Census County Business Patterns county thematic resource.
 *
 * <p>The retained CBP extract is the value authority and 2023 TIGERweb is the geometry authority.
 * A missing county/industry source row remains unavailable rather than becoming zero. Conversely,
 * every retained value for a requested state/industry must join to authoritative county geometry.
 */
@Service
public class CountyBusinessPatternsService {
    static final int REFERENCE_YEAR = 2023;

    private static final String CSV_RESOURCE =
            "/maps/county-business-patterns/cbp-2023-county.csv";
    private static final String METADATA_RESOURCE =
            "/maps/county-business-patterns/source.json";

    private static final Set<String> REQUIRED_HEADERS = Set.of(
            "GEOID",
            "INDUSTRY_CODE",
            "SOURCE_NAICS",
            "ESTABLISHMENTS",
            "EMPLOYMENT",
            "EMPLOYMENT_NOISE_FLAG",
            "FIRST_QUARTER_PAYROLL_THOUSANDS",
            "FIRST_QUARTER_PAYROLL_NOISE_FLAG",
            "ANNUAL_PAYROLL_THOUSANDS",
            "ANNUAL_PAYROLL_NOISE_FLAG");

    private static final Map<String, String> INDUSTRY_LABELS = Map.ofEntries(
            Map.entry("TOTAL", "All sectors"),
            Map.entry("11", "Agriculture, Forestry, Fishing and Hunting"),
            Map.entry("21", "Mining, Quarrying, and Oil and Gas Extraction"),
            Map.entry("22", "Utilities"),
            Map.entry("23", "Construction"),
            Map.entry("31", "31-33 Manufacturing"),
            Map.entry("42", "Wholesale Trade"),
            Map.entry("44", "44-45 Retail Trade"),
            Map.entry("48", "48-49 Transportation and Warehousing"),
            Map.entry("51", "Information"),
            Map.entry("52", "Finance and Insurance"),
            Map.entry("53", "Real Estate and Rental and Leasing"),
            Map.entry("54", "Professional, Scientific, and Technical Services"),
            Map.entry("55", "Management of Companies and Enterprises"),
            Map.entry("56", "Administrative and Support and Waste Management and Remediation Services"),
            Map.entry("61", "Educational Services"),
            Map.entry("62", "Health Care and Social Assistance"),
            Map.entry("71", "Arts, Entertainment, and Recreation"),
            Map.entry("72", "Accommodation and Food Services"),
            Map.entry("81", "Other Services (except Public Administration)"),
            Map.entry("99", "Industries not classified"));

    private final CensusAreaBoundaryService censusAreaBoundaryService;
    private final AdministrativeGeometryService administrativeGeometryService;
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final byte[] csvOverride;
    private final byte[] metadataOverride;

    private volatile SourceDataset cachedDataset;

    @Autowired
    public CountyBusinessPatternsService(
            CensusAreaBoundaryService censusAreaBoundaryService,
            AdministrativeGeometryService administrativeGeometryService) {
        this(censusAreaBoundaryService, administrativeGeometryService, null, null);
    }

    CountyBusinessPatternsService(
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

        CensusAreaBoundary boundary = censusAreaBoundaryService.listBoundaries().stream()
                .filter(candidate -> candidate.getGeography().equalsIgnoreCase(geography.strip()))
                .findFirst()
                .orElse(null);

        if (boundary == null) {
            return false;
        }

        String stateFips = StateFipsCatalog.forGeography(boundary.getGeography());
        return sourceDataset().stateFips().contains(stateFips);
    }

    public Choropleth findChoropleth(
            String geography,
            CountyBusinessPatternsMeasure measure,
            String industryCode,
            int year) {
        CensusAreaBoundary boundary = resolveBoundary(geography);
        SourceDataset dataset = sourceDataset();
        validateQuery(dataset.metadata(), measure, industryCode, year);

        String normalizedIndustry = normalizeIndustry(industryCode);
        String stateFips = StateFipsCatalog.forGeography(boundary.getGeography());
        if (!dataset.stateFips().contains(stateFips)) {
            throw new IllegalArgumentException(
                    "No retained 2023 County Business Patterns county values are available for "
                            + boundary.getGeography()
                            + ".");
        }

        AdministrativeGeometryService.AdministrativeGeometry geometry =
                administrativeGeometryService.countiesForState(stateFips, REFERENCE_YEAR);
        Map<String, JsonNode> geometryByGeoid = geometryByGeoid(geometry.geoJson(), stateFips);

        Map<String, SourceRow> selectedRows = new LinkedHashMap<>();
        for (Map.Entry<String, Map<String, SourceRow>> countyEntry : dataset.rowsByGeoid().entrySet()) {
            if (!countyEntry.getKey().startsWith(stateFips)) {
                continue;
            }
            SourceRow row = countyEntry.getValue().get(normalizedIndustry);
            if (row != null) {
                selectedRows.put(row.geoid(), row);
            }
        }

        Set<String> missingGeometry = new LinkedHashSet<>(selectedRows.keySet());
        missingGeometry.removeAll(geometryByGeoid.keySet());
        if (!missingGeometry.isEmpty()) {
            throw new IllegalStateException(
                    "No authoritative 2023 Census county geometry was returned for retained County Business Patterns GEOID "
                            + missingGeometry.iterator().next()
                            + ".");
        }

        ObjectNode geoJson = objectMapper.createObjectNode();
        geoJson.put("type", "FeatureCollection");
        geoJson.put("sourceReferenceYear", REFERENCE_YEAR);
        geoJson.put("geometryVintage", geometry.vintage());
        geoJson.put("measure", measure.name());
        geoJson.put("industryCode", normalizedIndustry);
        geoJson.put("year", year);
        ArrayNode features = geoJson.putArray("features");

        List<CountyValue> countyValues = new ArrayList<>();
        int availableCount = 0;

        for (Map.Entry<String, JsonNode> geometryEntry : geometryByGeoid.entrySet()) {
            String geoid = geometryEntry.getKey();
            JsonNode geometryFeature = geometryEntry.getValue();
            String name = geometryFeature.path("properties").path("NAME").asText();
            if (name.isBlank()) {
                name = geometryFeature.path("properties").path("BASENAME").asText();
            }
            if (name.isBlank()) {
                name = "County " + geoid;
            }

            SourceRow row = selectedRows.get(geoid);
            boolean available = row != null;
            Long value = available ? selectedValue(row, measure) : null;
            String noiseFlag = available ? noiseFlag(row, measure) : null;
            if (available) {
                availableCount += 1;
            }

            countyValues.add(new CountyValue(geoid, name, available, value, noiseFlag));

            ObjectNode feature = geometryFeature.deepCopy();
            ObjectNode properties = feature.withObject("properties");
            properties.put("fips", geoid);
            properties.put("name", name);
            properties.put("available", available);
            properties.put("measure", measure.name());
            properties.put("industryCode", normalizedIndustry);
            properties.put("year", year);
            if (value == null) {
                properties.putNull("value");
            } else {
                properties.put("value", value);
            }
            if (noiseFlag == null || noiseFlag.isBlank()) {
                properties.putNull("noiseFlag");
            } else {
                properties.put("noiseFlag", noiseFlag);
            }
            features.add(feature);
        }

        countyValues.sort(Comparator.comparing(CountyValue::name).thenComparing(CountyValue::fips));
        int unavailableCount = countyValues.size() - availableCount;

        SourceMetadata metadata = dataset.metadata();
        return new Choropleth(
                "county-business-patterns-" + slug(boundary.getGeography()),
                metadata.source(),
                metadata.sourceArchiveUrl(),
                "U.S. Census Bureau County Business Patterns",
                boundary.getGeography(),
                "COUNTY",
                metadata.referenceYear(),
                metadata.normalizedSha256(),
                metadata.capturedAt(),
                geometry.vintage(),
                geometry.sourceUrl(),
                geometry.attribution(),
                measure,
                measure.label(),
                measure.units(),
                normalizedIndustry,
                industryLabel(normalizedIndustry),
                year,
                availableCount,
                unavailableCount,
                metadata.excludedStatewideRows(),
                metadata.missingRowSemantics(),
                objectMapper.convertValue(geoJson, Map.class),
                List.copyOf(countyValues));
    }

    private void validateQuery(
            SourceMetadata metadata,
            CountyBusinessPatternsMeasure measure,
            String industryCode,
            int year) {
        if (measure == null) {
            throw new InvalidQueryException("County Business Patterns measure is required.");
        }
        if (year != metadata.referenceYear()) {
            throw new InvalidQueryException(
                    "Year " + year + " is not supported; County Business Patterns reference year is "
                            + metadata.referenceYear()
                            + ".");
        }

        String normalizedIndustry = normalizeIndustry(industryCode);
        if (!metadata.supportedIndustryCodes().contains(normalizedIndustry)) {
            throw new InvalidQueryException(
                    "County Business Patterns industry " + normalizedIndustry + " is not supported.");
        }
        if (!INDUSTRY_LABELS.containsKey(normalizedIndustry)) {
            throw new IllegalStateException(
                    "No display label is defined for retained County Business Patterns industry "
                            + normalizedIndustry
                            + ".");
        }
    }

    private CensusAreaBoundary resolveBoundary(String geography) {
        if (geography == null || geography.isBlank()) {
            throw new IllegalArgumentException("Geography must not be blank.");
        }

        return censusAreaBoundaryService.listBoundaries().stream()
                .filter(boundary -> boundary.getGeography().equalsIgnoreCase(geography.strip()))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("Unsupported Census geography: " + geography + "."));
    }

    private String normalizeIndustry(String industryCode) {
        if (industryCode == null || industryCode.isBlank()) {
            return "TOTAL";
        }
        String normalized = industryCode.strip().toUpperCase(Locale.ROOT);
        if (!"TOTAL".equals(normalized) && !normalized.matches("\\d{2}")) {
            throw new InvalidQueryException(
                    "County Business Patterns industry must be TOTAL or a retained two-digit sector code.");
        }
        return normalized;
    }

    private String industryLabel(String code) {
        String label = INDUSTRY_LABELS.get(code);
        if (label == null) {
            throw new IllegalStateException("No County Business Patterns industry label for " + code + ".");
        }
        return label;
    }

    private long selectedValue(SourceRow row, CountyBusinessPatternsMeasure measure) {
        return switch (measure) {
            case ESTABLISHMENTS -> row.establishments();
            case EMPLOYMENT -> row.employment();
            case FIRST_QUARTER_PAYROLL -> row.firstQuarterPayrollThousands();
            case ANNUAL_PAYROLL -> row.annualPayrollThousands();
        };
    }

    private String noiseFlag(SourceRow row, CountyBusinessPatternsMeasure measure) {
        return switch (measure) {
            case ESTABLISHMENTS -> null;
            case EMPLOYMENT -> row.employmentNoiseFlag();
            case FIRST_QUARTER_PAYROLL -> row.firstQuarterPayrollNoiseFlag();
            case ANNUAL_PAYROLL -> row.annualPayrollNoiseFlag();
        };
    }

    private Map<String, JsonNode> geometryByGeoid(ObjectNode geoJson, String stateFips) {
        Map<String, JsonNode> result = new LinkedHashMap<>();
        for (JsonNode feature : geoJson.path("features")) {
            String geoid = feature.path("properties").path("GEOID").asText();
            if (!geoid.matches("\\d{5}") || !geoid.startsWith(stateFips)) {
                throw new IllegalStateException("Authoritative Census county geometry returned an invalid GEOID.");
            }
            if (result.putIfAbsent(geoid, feature) != null) {
                throw new IllegalStateException(
                        "Authoritative Census county geometry returned duplicate GEOID " + geoid + ".");
            }
        }
        if (result.isEmpty()) {
            throw new IllegalStateException("Authoritative Census county geometry returned no counties.");
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

            byte[] metadataBytes = metadataOverride != null ? metadataOverride : readResourceBytes(METADATA_RESOURCE);
            byte[] csvBytes = csvOverride != null ? csvOverride : readResourceBytes(CSV_RESOURCE);
            SourceMetadata metadata = readMetadata(metadataBytes);

            String actualNormalizedSha = sha256(csvBytes);
            if (!actualNormalizedSha.equals(metadata.normalizedSha256())) {
                throw new IllegalStateException(
                        "Pinned County Business Patterns normalized checksum mismatch: expected "
                                + metadata.normalizedSha256()
                                + " but read "
                                + actualNormalizedSha
                                + ".");
            }

            cachedDataset = parseCsv(csvBytes, metadata);
            return cachedDataset;
        }
    }

    private SourceMetadata readMetadata(byte[] bytes) {
        final JsonNode root;
        try {
            root = objectMapper.readTree(bytes);
        } catch (IOException exception) {
            throw new IllegalStateException("County Business Patterns source metadata could not be read.", exception);
        }

        int referenceYear = root.path("referenceYear").asInt(-1);
        if (referenceYear != REFERENCE_YEAR) {
            throw new IllegalStateException(
                    "County Business Patterns source metadata must declare reference year "
                            + REFERENCE_YEAR
                            + ".");
        }
        if (!"FIPSCTY != 999".equals(root.path("countyEligibilityRule").asText())) {
            throw new IllegalStateException(
                    "County Business Patterns source metadata must record the county eligibility rule.");
        }

        List<String> supportedIndustryCodes = new ArrayList<>();
        for (JsonNode value : root.path("supportedIndustryCodes")) {
            supportedIndustryCodes.add(value.asText());
        }
        if (supportedIndustryCodes.isEmpty()) {
            throw new IllegalStateException(
                    "County Business Patterns source metadata must declare supported industry codes.");
        }

        return new SourceMetadata(
                requireMetadataText(root, "source"),
                URI.create(requireMetadataText(root, "sourceArchiveUrl")),
                referenceYear,
                requireMetadataText(root, "normalizedSha256"),
                LocalDate.parse(requireMetadataText(root, "capturedAt")),
                root.path("retainedRows").asInt(-1),
                root.path("retainedCounties").asInt(-1),
                root.path("excludedStatewideRows").asInt(-1),
                List.copyOf(supportedIndustryCodes),
                requireMetadataText(root, "missingRowSemantics"));
    }

    private SourceDataset parseCsv(byte[] csvBytes, SourceMetadata metadata) {
        CSVFormat format = CSVFormat.DEFAULT.builder()
                .setHeader()
                .setSkipHeaderRecord(true)
                .setDuplicateHeaderMode(DuplicateHeaderMode.DISALLOW)
                .setAllowMissingColumnNames(false)
                .get();

        Map<String, Map<String, SourceRow>> rowsByGeoid = new LinkedHashMap<>();
        Set<String> stateFips = new LinkedHashSet<>();
        Set<String> parsedIndustryCodes = new LinkedHashSet<>();
        int rowCount = 0;

        try (InputStreamReader reader =
                        new InputStreamReader(new ByteArrayInputStream(csvBytes), StandardCharsets.UTF_8);
                CSVParser parser = format.parse(reader)) {
            if (!parser.getHeaderMap().keySet().containsAll(REQUIRED_HEADERS)) {
                throw new IllegalStateException("County Business Patterns normalized source is missing required headers.");
            }

            for (CSVRecord record : parser) {
                String geoid = requirePattern(record, "GEOID", "\\d{5}");
                if (geoid.endsWith("999")) {
                    throw new IllegalStateException(
                            "County Business Patterns normalized source contains non-county aggregate GEOID "
                                    + geoid
                                    + ".");
                }
                String industryCode = requireIndustry(record.get("INDUSTRY_CODE").strip());
                String sourceNaics = requireSourceNaics(record.get("SOURCE_NAICS").strip(), industryCode);
                SourceRow row = new SourceRow(
                        geoid,
                        industryCode,
                        sourceNaics,
                        parseNonnegativeLong(record, "ESTABLISHMENTS"),
                        parseNonnegativeLong(record, "EMPLOYMENT"),
                        requireNoiseFlag(record.get("EMPLOYMENT_NOISE_FLAG").strip()),
                        parseNonnegativeLong(record, "FIRST_QUARTER_PAYROLL_THOUSANDS"),
                        requireNoiseFlag(record.get("FIRST_QUARTER_PAYROLL_NOISE_FLAG").strip()),
                        parseNonnegativeLong(record, "ANNUAL_PAYROLL_THOUSANDS"),
                        requireNoiseFlag(record.get("ANNUAL_PAYROLL_NOISE_FLAG").strip()));

                Map<String, SourceRow> byIndustry =
                        rowsByGeoid.computeIfAbsent(geoid, ignored -> new LinkedHashMap<>());
                if (byIndustry.putIfAbsent(industryCode, row) != null) {
                    throw new IllegalStateException(
                            "County Business Patterns normalized source contains duplicate county/industry row "
                                    + geoid
                                    + ":"
                                    + industryCode
                                    + ".");
                }
                stateFips.add(geoid.substring(0, 2));
                parsedIndustryCodes.add(industryCode);
                rowCount += 1;
            }
        } catch (IOException exception) {
            throw new IllegalStateException("County Business Patterns normalized source could not be parsed.", exception);
        }

        if (rowCount != metadata.retainedRows()) {
            throw new IllegalStateException(
                    "County Business Patterns retained row count mismatch: metadata declares "
                            + metadata.retainedRows()
                            + " but parsed "
                            + rowCount
                            + ".");
        }
        if (rowsByGeoid.size() != metadata.retainedCounties()) {
            throw new IllegalStateException(
                    "County Business Patterns retained county count mismatch: metadata declares "
                            + metadata.retainedCounties()
                            + " but parsed "
                            + rowsByGeoid.size()
                            + ".");
        }
        if (!parsedIndustryCodes.equals(new LinkedHashSet<>(metadata.supportedIndustryCodes()))) {
            throw new IllegalStateException(
                    "County Business Patterns supported industry codes do not match the normalized source.");
        }
        if (metadata.excludedStatewideRows() < 0) {
            throw new IllegalStateException(
                    "County Business Patterns excluded statewide row count must be nonnegative.");
        }

        Map<String, Map<String, SourceRow>> immutableRows = new LinkedHashMap<>();
        rowsByGeoid.forEach((geoid, rows) -> immutableRows.put(geoid, Map.copyOf(rows)));
        return new SourceDataset(metadata, Map.copyOf(immutableRows), Set.copyOf(stateFips));
    }

    private String requirePattern(CSVRecord record, String column, String pattern) {
        String value = record.get(column).strip();
        if (!value.matches(pattern)) {
            throw new IllegalStateException(
                    "County Business Patterns normalized source contains invalid " + column + " value " + value + ".");
        }
        return value;
    }

    private String requireIndustry(String value) {
        if ("TOTAL".equals(value) || value.matches("\\d{2}")) {
            return value;
        }
        throw new IllegalStateException(
                "County Business Patterns normalized source contains invalid industry code " + value + ".");
    }

    private String requireSourceNaics(String value, String industryCode) {
        String expected = "TOTAL".equals(industryCode) ? "------" : industryCode + "----";
        if (!expected.equals(value)) {
            throw new IllegalStateException(
                    "County Business Patterns normalized source has inconsistent source NAICS "
                            + value
                            + " for industry "
                            + industryCode
                            + ".");
        }
        return value;
    }

    private long parseNonnegativeLong(CSVRecord record, String column) {
        String value = record.get(column).strip();
        try {
            long parsed = Long.parseLong(value);
            if (parsed < 0L) {
                throw new NumberFormatException("negative");
            }
            return parsed;
        } catch (NumberFormatException exception) {
            throw new IllegalStateException(
                    "County Business Patterns normalized source contains invalid " + column + " value " + value + ".",
                    exception);
        }
    }

    private String requireNoiseFlag(String value) {
        if (value.isEmpty() || "G".equals(value) || "H".equals(value) || "J".equals(value)) {
            return value;
        }
        throw new IllegalStateException(
                "County Business Patterns normalized source contains invalid noise flag " + value + ".");
    }

    private String requireMetadataText(JsonNode root, String field) {
        String value = root.path(field).asText();
        if (value.isBlank()) {
            throw new IllegalStateException(
                    "County Business Patterns source metadata is missing " + field + ".");
        }
        return value;
    }

    private byte[] readResourceBytes(String resource) {
        try (var input = getClass().getResourceAsStream(resource)) {
            if (input == null) {
                throw new IllegalStateException("Missing County Business Patterns resource " + resource + ".");
            }
            return input.readAllBytes();
        } catch (IOException exception) {
            throw new IllegalStateException("Unable to read County Business Patterns resource " + resource + ".", exception);
        }
    }

    private String sha256(byte[] bytes) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));
        } catch (Exception exception) {
            throw new IllegalStateException("SHA-256 is unavailable.", exception);
        }
    }

    private String slug(String geography) {
        return geography.toLowerCase(Locale.ROOT).replace(' ', '-');
    }

    public record CountyValue(
            String fips,
            String name,
            boolean available,
            Long value,
            String noiseFlag) {}

    public record Choropleth(
            String layerId,
            String source,
            URI sourceUrl,
            String attribution,
            String geography,
            String geographyLevel,
            int sourceReferenceYear,
            String sourceSha256,
            LocalDate capturedAt,
            int geometryVintage,
            URI geometrySourceUrl,
            String geometryAttribution,
            CountyBusinessPatternsMeasure measure,
            String measureLabel,
            String units,
            String industryCode,
            String industryLabel,
            int year,
            int availableCountyCount,
            int unavailableCountyCount,
            int excludedStatewideRows,
            String missingRowSemantics,
            Map<String, Object> geoJson,
            List<CountyValue> counties) {}

    private record SourceRow(
            String geoid,
            String industryCode,
            String sourceNaics,
            long establishments,
            long employment,
            String employmentNoiseFlag,
            long firstQuarterPayrollThousands,
            String firstQuarterPayrollNoiseFlag,
            long annualPayrollThousands,
            String annualPayrollNoiseFlag) {}

    private record SourceMetadata(
            String source,
            URI sourceArchiveUrl,
            int referenceYear,
            String normalizedSha256,
            LocalDate capturedAt,
            int retainedRows,
            int retainedCounties,
            int excludedStatewideRows,
            List<String> supportedIndustryCodes,
            String missingRowSemantics) {}

    private record SourceDataset(
            SourceMetadata metadata,
            Map<String, Map<String, SourceRow>> rowsByGeoid,
            Set<String> stateFips) {}

    static final class InvalidQueryException extends IllegalArgumentException {
        InvalidQueryException(String message) {
            super(message);
        }
    }
}
