package org.civicsrepo.search;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class SearchServiceTest {
    private final SearchService searchService = new SearchService();

    @Test
    void keywordSearchFindsNorthDakotaResearchObjects() {
        SearchResponse response = searchService.search("North Dakota", null, null, null, 0, 25);

        assertThat(response.query()).isEqualTo("North Dakota");
        assertThat(response.totalResults()).isGreaterThanOrEqualTo(3);
        assertThat(response.results())
                .extracting(SearchResult::id)
                .contains(
                        "tiger-line-north-dakota-2025",
                        "lodes-wac-north-dakota-2023",
                        "acs-pums-north-dakota-2024");
    }

    @Test
    void keywordSearchFindsOtherCensusAreas() {
        SearchResponse response = searchService.search("California", null, null, null, 0, 25);

        assertThat(response.totalResults()).isGreaterThanOrEqualTo(3);
        assertThat(response.results())
                .extracting(SearchResult::geography)
                .containsOnly("California");
    }

    @Test
    void geographyFilterSupportsAnySeededCensusArea() {
        SearchResponse response = searchService.search("", null, "Texas", null, 0, 25);

        assertThat(response.totalResults()).isGreaterThanOrEqualTo(3);
        assertThat(response.results())
                .extracting(SearchResult::id)
                .contains("tiger-line-texas-2025", "lodes-wac-texas-2023", "acs-pums-texas-2024");
    }

    @Test
    void programFilterReturnsSelectedFacet() {
        SearchResponse response = searchService.search("", ResearchProgram.USGS, null, null, 0, 25);

        assertThat(response.results()).singleElement().extracting(SearchResult::program).isEqualTo(ResearchProgram.USGS);
        assertThat(response.facets())
                .filteredOn((facet) -> facet.field().equals("program"))
                .singleElement()
                .satisfies((facet) ->
                        assertThat(facet.values())
                                .filteredOn(FacetValue::selected)
                                .singleElement()
                                .extracting(FacetValue::value)
                                .isEqualTo("USGS"));
    }
}
