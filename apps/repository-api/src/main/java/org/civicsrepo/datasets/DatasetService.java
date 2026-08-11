package org.civicsrepo.datasets;

import java.time.LocalDate;
import java.util.List;
import java.util.Locale;
import org.civicsrepo.search.ResearchProgram;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class DatasetService {
    public DatasetDetail getDataset(String datasetId) {
        DatasetKey key = parseDatasetId(datasetId);

        return switch (key.program()) {
            case TIGER_LINE -> tigerLineDetail(datasetId, key.geography(), key.vintageYear());
            case LODES -> lodesDetail(datasetId, key.geography(), key.vintageYear());
            case ACS -> acsDetail(datasetId, key.geography(), key.vintageYear());
            case SIPP -> nationalDetail(
                    datasetId,
                    "SIPP Public Use Data",
                    ResearchProgram.SIPP,
                    "Survey of Income and Program Participation public-use files and documentation for longitudinal income, program participation, and household research.",
                    "https://www.census.gov/programs-surveys/sipp/data/datasets.html");
            case CPS -> nationalDetail(
                    datasetId,
                    "Current Population Survey Public Use Data",
                    ResearchProgram.CPS,
                    "Current Population Survey public-use files and documentation for labor force, employment, and demographic research.",
                    "https://www.census.gov/programs-surveys/cps/data/datasets.html");
            case USGS -> usgsDetail(datasetId);
            default -> throw notFound(datasetId);
        };
    }

    public List<DatasetVersion> getDatasetVersions(String datasetId) {
        DatasetDetail detail = getDataset(datasetId);
        int currentYear = detail.vintageYear() == null ? 2026 : detail.vintageYear();

        return List.of(
                new DatasetVersion(datasetId + "-current", detail.title(), detail.releasedOn(), true),
                new DatasetVersion(datasetId + "-previous", detail.program() + " " + (currentYear - 1), LocalDate.of(currentYear - 1, 8, 1), false));
    }

    private DatasetDetail tigerLineDetail(String datasetId, String geography, int vintageYear) {
        return new DatasetDetail(
                datasetId,
                vintageYear + " TIGER/Line - Census Tracts - " + geography,
                ResearchProgram.TIGER_LINE,
                "U.S. Census Bureau",
                "Cartographic boundary and tract geometry metadata for " + geography + " census geography, represented as a repository research object with source links, file manifests, and map-layer metadata.",
                geography,
                vintageYear,
                LocalDate.of(vintageYear, 8, 1),
                List.of(
                        new DatasetFile("source-zip", "TIGER/Line source archive", FileFormat.ZIP, "https://www2.census.gov/geo/tiger/TIGER" + vintageYear + "/", null),
                        new DatasetFile("metadata-html", "TIGER/Line technical documentation", FileFormat.OTHER, "https://www.census.gov/geographies/mapping-files/time-series/geo/tiger-line-file.html", null)),
                "U.S. Census Bureau. " + vintageYear + " TIGER/Line Shapefiles: Census Tracts, " + geography + ".",
                "https://www.census.gov/geographies/mapping-files/time-series/geo/tiger-line-file.html",
                EvidenceStatus.AUTOMATED_PASS);
    }

    private DatasetDetail lodesDetail(String datasetId, String geography, int vintageYear) {
        return new DatasetDetail(
                datasetId,
                vintageYear + " LODES Workplace Area Characteristics - " + geography,
                ResearchProgram.LODES,
                "U.S. Census Bureau",
                "LEHD Origin-Destination Employment Statistics metadata for " + geography + " workforce geography and workplace area characteristics.",
                geography,
                vintageYear,
                LocalDate.of(vintageYear, 6, 1),
                List.of(
                        new DatasetFile("lodes-csv", "LODES workplace characteristics CSV manifest", FileFormat.CSV, "https://lehd.ces.census.gov/data/", null),
                        new DatasetFile("lodes-docs", "LODES documentation", FileFormat.PDF, "https://lehd.ces.census.gov/data/lodes/LODES7/LODESTechDoc7.5.pdf", null)),
                "U.S. Census Bureau. LEHD Origin-Destination Employment Statistics, Workplace Area Characteristics, " + geography + ", " + vintageYear + ".",
                "https://lehd.ces.census.gov/data/",
                EvidenceStatus.MANUAL_REVIEW_REQUIRED);
    }

    private DatasetDetail acsDetail(String datasetId, String geography, int vintageYear) {
        return new DatasetDetail(
                datasetId,
                vintageYear + " ACS 1-Year PUMS - " + geography,
                ResearchProgram.ACS,
                "U.S. Census Bureau",
                "American Community Survey public use microdata metadata for " + geography + " demographic research, prepared as a repository object before any large file mirroring.",
                geography,
                vintageYear,
                LocalDate.of(vintageYear, 10, 1),
                List.of(
                        new DatasetFile("pums-data", "ACS PUMS data access page", FileFormat.OTHER, "https://www.census.gov/programs-surveys/acs/microdata.html", null),
                        new DatasetFile("pums-docs", "ACS PUMS documentation", FileFormat.PDF, "https://www.census.gov/programs-surveys/acs/technical-documentation/pums/documentation.html", null)),
                "U.S. Census Bureau. American Community Survey Public Use Microdata Sample, " + geography + ", " + vintageYear + ".",
                "https://www.census.gov/programs-surveys/acs/microdata.html",
                EvidenceStatus.MANUAL_REVIEW_REQUIRED);
    }

    private DatasetDetail nationalDetail(
            String datasetId,
            String title,
            ResearchProgram program,
            String abstractText,
            String sourceUrl) {
        return new DatasetDetail(
                datasetId,
                title,
                program,
                "U.S. Census Bureau",
                abstractText,
                "United States",
                2024,
                LocalDate.of(2024, 9, 1),
                List.of(new DatasetFile("source-page", title + " source page", FileFormat.OTHER, sourceUrl, null)),
                "U.S. Census Bureau. " + title + ".",
                sourceUrl,
                EvidenceStatus.MANUAL_REVIEW_REQUIRED);
    }

    private DatasetDetail usgsDetail(String datasetId) {
        return new DatasetDetail(
                datasetId,
                "USGS Earthquake Overlay",
                ResearchProgram.USGS,
                "U.S. Geological Survey",
                "Earthquake Hazards Program GeoJSON overlay metadata for contextual map display, event lists, and repository-linked public data evidence.",
                "United States",
                2026,
                LocalDate.of(2026, 8, 11),
                List.of(new DatasetFile("earthquake-geojson", "USGS earthquake GeoJSON feed", FileFormat.GEOJSON, "https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson", null)),
                "U.S. Geological Survey. Earthquake Catalog GeoJSON Feed.",
                "https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson",
                EvidenceStatus.AUTOMATED_PASS);
    }

    private DatasetKey parseDatasetId(String datasetId) {
        String normalized = datasetId == null ? "" : datasetId.toLowerCase(Locale.ROOT);

        if (normalized.startsWith("tiger-line-") && normalized.endsWith("-2025")) {
            return new DatasetKey(ResearchProgram.TIGER_LINE, geographyFromId(normalized, "tiger-line-", "-2025"), 2025);
        }

        if (normalized.startsWith("lodes-wac-") && normalized.endsWith("-2023")) {
            return new DatasetKey(ResearchProgram.LODES, geographyFromId(normalized, "lodes-wac-", "-2023"), 2023);
        }

        if (normalized.startsWith("acs-pums-") && normalized.endsWith("-2024")) {
            return new DatasetKey(ResearchProgram.ACS, geographyFromId(normalized, "acs-pums-", "-2024"), 2024);
        }

        if (normalized.equals("sipp-public-use")) {
            return new DatasetKey(ResearchProgram.SIPP, "United States", 2024);
        }

        if (normalized.equals("cps-public-use")) {
            return new DatasetKey(ResearchProgram.CPS, "United States", 2024);
        }

        if (normalized.equals("usgs-earthquakes-overlay")) {
            return new DatasetKey(ResearchProgram.USGS, "United States", 2026);
        }

        throw notFound(datasetId);
    }

    private String geographyFromId(String datasetId, String prefix, String suffix) {
        String slug = datasetId.substring(prefix.length(), datasetId.length() - suffix.length());
        String[] words = slug.split("-");
        StringBuilder geography = new StringBuilder();

        for (String word : words) {
            if (!geography.isEmpty()) {
                geography.append(' ');
            }
            geography.append(word.substring(0, 1).toUpperCase(Locale.ROOT)).append(word.substring(1));
        }

        return geography.toString();
    }

    private ResponseStatusException notFound(String datasetId) {
        return new ResponseStatusException(HttpStatus.NOT_FOUND, "Dataset not found: " + datasetId);
    }

    private record DatasetKey(ResearchProgram program, String geography, int vintageYear) {}
}
