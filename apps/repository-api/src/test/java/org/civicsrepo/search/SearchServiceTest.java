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
                .contains("tiger-line-nd-2025", "lodes-nd-wac-2023", "acs-pums-nd-2024");
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
