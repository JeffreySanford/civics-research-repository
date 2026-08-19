package org.civicsrepo.search;

import org.civicsrepo.generated.dto.FacetValue;
import org.civicsrepo.generated.dto.ResearchProgram;
import org.civicsrepo.generated.dto.SearchResponse;
import org.civicsrepo.generated.dto.SearchResult;
import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import org.junit.jupiter.api.Test;

class SearchServiceTest {
    private final SearchService searchService = new SearchService();

    @Test
    void keywordSearchFindsNorthDakotaResearchObjects() {
        SearchResponse response = searchService.search("North Dakota", List.of(), null, null, null, 0, 25);

        assertThat(response.getQuery()).isEqualTo("North Dakota");
        assertThat(response.getTotalResults()).isGreaterThanOrEqualTo(3);
        assertThat(response.getResults())
                .extracting(SearchResult::getId)
                .contains(
                        "tiger-line-north-dakota-2025",
                        "lodes-wac-north-dakota-2023",
                        "acs-pums-north-dakota-2024");
    }

    @Test
    void keywordSearchFindsOtherCensusAreas() {
        SearchResponse response = searchService.search("California", List.of(), null, null, null, 0, 25);

        assertThat(response.getTotalResults()).isGreaterThanOrEqualTo(3);
        assertThat(response.getResults())
                .extracting(SearchResult::getGeography)
                .containsOnly("California");
    }

    @Test
    void geographyFilterSupportsAnySeededCensusArea() {
        SearchResponse response = searchService.search("", List.of(), "Texas", null, null, 0, 25);

        assertThat(response.getTotalResults()).isGreaterThanOrEqualTo(3);
        assertThat(response.getResults())
                .extracting(SearchResult::getId)
                .contains("tiger-line-texas-2025", "lodes-wac-texas-2023", "acs-pums-texas-2024");
    }

    @Test
    void programFilterReturnsSelectedFacet() {
        SearchResponse response = searchService.search("", List.of(ResearchProgram.USGS), null, null, null, 0, 25);

        assertThat(response.getResults()).singleElement().extracting(SearchResult::getProgram).isEqualTo(ResearchProgram.USGS);
        assertThat(response.getFacets())
                .filteredOn((facet) -> facet.getField().equals("program"))
                .singleElement()
                .satisfies((facet) ->
                        assertThat(facet.getValues())
                                .filteredOn(FacetValue::getSelected)
                                .singleElement()
                                .extracting(FacetValue::getValue)
                                .isEqualTo("USGS"));
    }

    /** Several selected programs are a union, not an intersection. */
    @Test
    void severalProgramsReturnTheUnionOfTheirResults() {
        SearchResponse response = searchService.search(
                "", List.of(ResearchProgram.TIGER_LINE, ResearchProgram.LODES), "Texas", null, null, 0, 25);

        assertThat(response.getResults())
                .extracting(SearchResult::getProgram)
                .containsOnly(ResearchProgram.TIGER_LINE, ResearchProgram.LODES);
    }

    /** Facet counts must not collapse to the selected program, or the others become unselectable. */
    @Test
    void programFacetCountsIgnoreTheProgramFilter() {
        SearchResponse response =
                searchService.search("", List.of(ResearchProgram.USGS), null, null, null, 0, 25);

        assertThat(response.getFacets())
                .filteredOn((facet) -> facet.getField().equals("program"))
                .singleElement()
                .satisfies((facet) -> assertThat(facet.getValues().size()).isGreaterThan(1));
    }
}
