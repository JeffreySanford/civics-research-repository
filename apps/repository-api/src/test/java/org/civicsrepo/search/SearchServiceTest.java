package org.civicsrepo.search;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import org.junit.jupiter.api.Test;

class SearchServiceTest {
    private final SearchService searchService = new SearchService();

    @Test
    void keywordSearchFindsNorthDakotaResearchObjects() {
        SearchResponse response = searchService.search("North Dakota", List.of(), null, null, 0, 25);

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
        SearchResponse response = searchService.search("California", List.of(), null, null, 0, 25);

        assertThat(response.totalResults()).isGreaterThanOrEqualTo(3);
        assertThat(response.results())
                .extracting(SearchResult::geography)
                .containsOnly("California");
    }

    @Test
    void geographyFilterSupportsAnySeededCensusArea() {
        SearchResponse response = searchService.search("", List.of(), "Texas", null, 0, 25);

        assertThat(response.totalResults()).isGreaterThanOrEqualTo(3);
        assertThat(response.results())
                .extracting(SearchResult::id)
                .contains("tiger-line-texas-2025", "lodes-wac-texas-2023", "acs-pums-texas-2024");
    }

    @Test
    void programFilterReturnsSelectedFacet() {
        SearchResponse response = searchService.search("", List.of(ResearchProgram.USGS), null, null, 0, 25);

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

    /** Several selected programs are a union, not an intersection. */
    @Test
    void severalProgramsReturnTheUnionOfTheirResults() {
        SearchResponse response = searchService.search(
                "", List.of(ResearchProgram.TIGER_LINE, ResearchProgram.LODES), "Texas", null, 0, 25);

        assertThat(response.results())
                .extracting(SearchResult::program)
                .containsOnly(ResearchProgram.TIGER_LINE, ResearchProgram.LODES);
    }

    /** Facet counts must not collapse to the selected program, or the others become unselectable. */
    @Test
    void programFacetCountsIgnoreTheProgramFilter() {
        SearchResponse response =
                searchService.search("", List.of(ResearchProgram.USGS), null, null, 0, 25);

        assertThat(response.facets())
                .filteredOn((facet) -> facet.field().equals("program"))
                .singleElement()
                .satisfies((facet) -> assertThat(facet.values().size()).isGreaterThan(1));
    }
}
