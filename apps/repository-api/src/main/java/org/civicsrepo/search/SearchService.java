package org.civicsrepo.search;

import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import org.civicsrepo.repository.RepositoryCatalog;
import org.civicsrepo.repository.RepositorySource;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

@Service
public class SearchService {
    private static final Logger LOGGER = LoggerFactory.getLogger(SearchService.class);
    private static final List<String> CENSUS_AREAS = List.of(
            "Alabama",
            "Alaska",
            "Arizona",
            "Arkansas",
            "California",
            "Colorado",
            "Connecticut",
            "Delaware",
            "District of Columbia",
            "Florida",
            "Georgia",
            "Hawaii",
            "Idaho",
            "Illinois",
            "Indiana",
            "Iowa",
            "Kansas",
            "Kentucky",
            "Louisiana",
            "Maine",
            "Maryland",
            "Massachusetts",
            "Michigan",
            "Minnesota",
            "Mississippi",
            "Missouri",
            "Montana",
            "Nebraska",
            "Nevada",
            "New Hampshire",
            "New Jersey",
            "New Mexico",
            "New York",
            "North Carolina",
            "North Dakota",
            "Ohio",
            "Oklahoma",
            "Oregon",
            "Pennsylvania",
            "Puerto Rico",
            "Rhode Island",
            "South Carolina",
            "South Dakota",
            "Tennessee",
            "Texas",
            "Utah",
            "Vermont",
            "Virginia",
            "Washington",
            "West Virginia",
            "Wisconsin",
            "Wyoming");
    private static final List<SearchResult> SEED_RESULTS = seedResultsForAllCensusAreas();

    private final SolrSearchClient solrSearchClient;
    private final RepositoryCatalog repositoryCatalog;

    public SearchService() {
        this(null, null);
    }

    @Autowired
    public SearchService(SolrSearchClient solrSearchClient, RepositoryCatalog repositoryCatalog) {
        this.solrSearchClient = solrSearchClient;
        this.repositoryCatalog = repositoryCatalog;
    }

    /**
     * The generated placeholder catalog.
     *
     * <p>Retained only as a fallback for tests and for demo recovery when the repository is not
     * available. Every response built from it is labelled {@link RepositorySource#FIXTURE}.
     */
    public List<SearchResult> fixtureResults() {
        return SEED_RESULTS;
    }

    public SearchResponse search(
            String query,
            ResearchProgram program,
            String geography,
            Integer vintageYear,
            int page,
            int pageSize) {
        // Solr holds the projection built by DiscoveryProjectionService, so it is the fast path for
        // both repository-backed and fixture-backed content. Its source label comes from what was
        // last projected, not from the query.
        if (solrSearchClient != null && solrSearchClient.isEnabled()) {
            try {
                return solrSearchClient
                        .search(query, program, geography, vintageYear, page, pageSize)
                        .withResultSource(indexedSource());
            } catch (RuntimeException exception) {
                LOGGER.warn("Solr search failed; answering from in-memory results.", exception);
            }
        }

        List<SearchResult> repositoryObjects =
                repositoryCatalog == null ? List.of() : repositoryCatalog.findAllResearchObjects();
        if (!repositoryObjects.isEmpty()) {
            return searchInMemory(
                    repositoryObjects, RepositorySource.REPOSITORY, query, program, geography, vintageYear, page, pageSize);
        }

        return searchInMemory(
                SEED_RESULTS, RepositorySource.FIXTURE, query, program, geography, vintageYear, page, pageSize);
    }

    /**
     * Whether the Solr projection currently holds repository content.
     *
     * <p>Derived by asking the repository rather than by trusting the index, so a stale index
     * cannot cause fixture content to be labelled as repository content.
     */
    private RepositorySource indexedSource() {
        boolean repositoryBacked = repositoryCatalog != null && !repositoryCatalog.findAllResearchObjects().isEmpty();
        return repositoryBacked ? RepositorySource.REPOSITORY : RepositorySource.FIXTURE;
    }

    private SearchResponse searchInMemory(
            List<SearchResult> catalog,
            RepositorySource resultSource,
            String query,
            ResearchProgram program,
            String geography,
            Integer vintageYear,
            int page,
            int pageSize) {
        String normalizedQuery = normalize(query);
        String normalizedGeography = normalize(geography);

        List<SearchResult> filtered = catalog.stream()
                .filter((result) -> matchesQuery(result, normalizedQuery))
                .filter((result) -> program == null || result.program() == program)
                .filter((result) ->
                        normalizedGeography.isBlank() || normalize(result.geography()).contains(normalizedGeography))
                .filter((result) -> vintageYear == null || vintageYear.equals(result.vintageYear()))
                .sorted(Comparator.comparing(SearchResult::title))
                .toList();

        int safePage = Math.max(0, page);
        int safePageSize = Math.max(1, Math.min(pageSize, 100));
        int fromIndex = Math.min(safePage * safePageSize, filtered.size());
        int toIndex = Math.min(fromIndex + safePageSize, filtered.size());

        return new SearchResponse(
                resultSource,
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

    private static List<SearchResult> seedResultsForAllCensusAreas() {
        return Stream.concat(
                        CENSUS_AREAS.stream().flatMap(SearchService::stateLevelCensusResults),
                        Stream.of(
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
                                        "https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson")))
                .toList();
    }

    private static Stream<SearchResult> stateLevelCensusResults(String censusArea) {
        String idSuffix = censusArea.toLowerCase(Locale.ROOT).replace(" ", "-");
        return Stream.of(
                new SearchResult(
                        "tiger-line-" + idSuffix + "-2025",
                        "2025 TIGER/Line - Census Tracts - " + censusArea,
                        ResearchObjectType.DATASET,
                        ResearchProgram.TIGER_LINE,
                        "U.S. Census Bureau",
                        "Cartographic boundary and tract geometry metadata for " + censusArea + " census geography.",
                        censusArea,
                        2025,
                        "https://www.census.gov/geographies/mapping-files/time-series/geo/tiger-line-file.html"),
                new SearchResult(
                        "lodes-wac-" + idSuffix + "-2023",
                        "2023 LODES Workplace Area Characteristics - " + censusArea,
                        ResearchObjectType.DATASET,
                        ResearchProgram.LODES,
                        "U.S. Census Bureau",
                        "LEHD Origin-Destination Employment Statistics metadata for " + censusArea + " workforce geography.",
                        censusArea,
                        2023,
                        "https://lehd.ces.census.gov/data/"),
                new SearchResult(
                        "acs-pums-" + idSuffix + "-2024",
                        "2024 ACS 1-Year PUMS - " + censusArea,
                        ResearchObjectType.DATASET,
                        ResearchProgram.ACS,
                        "U.S. Census Bureau",
                        "American Community Survey public use microdata metadata for " + censusArea + " demographic research.",
                        censusArea,
                        2024,
                        "https://www.census.gov/programs-surveys/acs/microdata.html"));
    }
}
