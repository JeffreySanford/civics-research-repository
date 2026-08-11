package org.civicsrepo.search;

import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;

@Service
public class SearchService {
    private static final List<SearchResult> SEED_RESULTS = List.of(
            new SearchResult(
                    "tiger-line-nd-2025",
                    "2025 TIGER/Line - Census Tracts - North Dakota",
                    ResearchObjectType.DATASET,
                    ResearchProgram.TIGER_LINE,
                    "U.S. Census Bureau",
                    "Cartographic boundary and tract geometry metadata for the North Dakota map visualization slice.",
                    "North Dakota",
                    2025,
                    "https://www.census.gov/geographies/mapping-files/time-series/geo/tiger-line-file.html"),
            new SearchResult(
                    "lodes-nd-wac-2023",
                    "2023 LODES - North Dakota Workplace Area Characteristics",
                    ResearchObjectType.DATASET,
                    ResearchProgram.LODES,
                    "U.S. Census Bureau",
                    "LEHD Origin-Destination Employment Statistics metadata for workforce geography exploration.",
                    "North Dakota",
                    2023,
                    "https://lehd.ces.census.gov/data/"),
            new SearchResult(
                    "acs-pums-nd-2024",
                    "2024 ACS 1-Year PUMS - North Dakota",
                    ResearchObjectType.DATASET,
                    ResearchProgram.ACS,
                    "U.S. Census Bureau",
                    "American Community Survey public use microdata metadata for demographic research discovery.",
                    "North Dakota",
                    2024,
                    "https://www.census.gov/programs-surveys/acs/microdata.html"),
            new SearchResult(
                    "sipp-public-use",
                    "SIPP Public Use Data",
                    ResearchObjectType.DATASET,
                    ResearchProgram.SIPP,
                    "U.S. Census Bureau",
                    "Survey of Income and Program Participation public-use metadata for longitudinal research.",
                    "United States",
                    2024,
                    "https://www.census.gov/programs-surveys/sipp/data/datasets.html"),
            new SearchResult(
                    "cps-public-use",
                    "Current Population Survey Public Use Data",
                    ResearchObjectType.DATASET,
                    ResearchProgram.CPS,
                    "U.S. Census Bureau",
                    "Current Population Survey public-use metadata for labor force and demographic analysis.",
                    "United States",
                    2024,
                    "https://www.census.gov/programs-surveys/cps/data/datasets.html"),
            new SearchResult(
                    "usgs-earthquakes-overlay",
                    "USGS Earthquake Overlay",
                    ResearchObjectType.DATASET,
                    ResearchProgram.USGS,
                    "U.S. Geological Survey",
                    "Earthquake Hazards Program GeoJSON overlay metadata for map context and event lists.",
                    "United States",
                    2026,
                    "https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson"));

    public SearchResponse search(
            String query,
            ResearchProgram program,
            String geography,
            Integer vintageYear,
            int page,
            int pageSize) {
        String normalizedQuery = normalize(query);
        String normalizedGeography = normalize(geography);

        List<SearchResult> filtered = SEED_RESULTS.stream()
                .filter((result) -> matchesQuery(result, normalizedQuery))
                .filter((result) -> program == null || result.program() == program)
                .filter((result) ->
                        normalizedGeography.isBlank() || normalize(result.geography()).contains(normalizedGeography))
                .filter((result) -> vintageYear == null || result.vintageYear().equals(vintageYear))
                .sorted(Comparator.comparing(SearchResult::title))
                .toList();

        int safePage = Math.max(0, page);
        int safePageSize = Math.max(1, Math.min(pageSize, 100));
        int fromIndex = Math.min(safePage * safePageSize, filtered.size());
        int toIndex = Math.min(fromIndex + safePageSize, filtered.size());

        return new SearchResponse(
                query == null ? "" : query,
                safePage,
                safePageSize,
                filtered.size(),
                filtered.subList(fromIndex, toIndex),
                List.of(
                        facetGroup(
                                "program",
                                "Program",
                                filtered,
                                (result) -> result.program().name(),
                                program == null ? "" : program.name()),
                        facetGroup("geography", "Geography", filtered, SearchResult::geography, geography == null ? "" : geography)));
    }

    private boolean matchesQuery(SearchResult result, String normalizedQuery) {
        if (normalizedQuery.isBlank()) {
            return true;
        }

        return normalize(result.title()).contains(normalizedQuery)
                || normalize(result.summary()).contains(normalizedQuery)
                || normalize(result.publisher()).contains(normalizedQuery)
                || normalize(result.program().name()).contains(normalizedQuery);
    }

    private FacetGroup facetGroup(
            String field,
            String label,
            List<SearchResult> results,
            Function<SearchResult, String> valueSelector,
            String selectedValue) {
        String normalizedSelected = normalize(selectedValue);
        Map<String, Long> counts = results.stream()
                .collect(Collectors.groupingBy(valueSelector, Collectors.counting()));

        List<FacetValue> values = counts.entrySet().stream()
                .sorted(Map.Entry.comparingByKey())
                .map((entry) -> new FacetValue(
                        entry.getKey(),
                        entry.getKey().replace('_', ' '),
                        entry.getValue(),
                        normalize(entry.getKey()).equals(normalizedSelected)))
                .toList();

        return new FacetGroup(field, label, values);
    }

    private String normalize(String value) {
        return value == null ? "" : value.trim().toLowerCase(Locale.ROOT);
    }
}
