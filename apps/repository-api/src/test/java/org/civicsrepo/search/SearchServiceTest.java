package org.civicsrepo.search;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import org.civicsrepo.generated.dto.FacetValue;
import org.civicsrepo.generated.dto.ResearchProgram;
import org.civicsrepo.generated.dto.SearchResponse;
import org.civicsrepo.generated.dto.SearchResult;
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
        SearchResponse response = searchService.search("", List.of("USGS"), null, null, null, 0, 25);

        assertThat(response.getResults())
                .singleElement()
                .extracting(SearchResult::getProgram)
                .isEqualTo(ResearchProgram.USGS);
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

    @Test
    void severalProgramsReturnTheUnionOfTheirResults() {
        SearchResponse response = searchService.search(
                "", List.of("TIGER_LINE", "LODES"), "Texas", null, null, 0, 25);

        assertThat(response.getResults())
                .extracting(SearchResult::getProgram)
                .containsOnly(ResearchProgram.TIGER_LINE, ResearchProgram.LODES);
    }

    @Test
    void programFacetCountsIgnoreTheProgramFilter() {
        SearchResponse response = searchService.search("", List.of("USGS"), null, null, null, 0, 25);

        assertThat(response.getFacets())
                .filteredOn((facet) -> facet.getField().equals("program"))
                .singleElement()
                .satisfies((facet) -> assertThat(facet.getValues().size()).isGreaterThan(1));
    }

    @Test
    void publisherAndSourceFacetsComeFromResultData() {
        SearchResponse response = searchService.search("", List.of(), null, null, null, 0, 25);

        assertThat(response.getFacets())
                .filteredOn((facet) -> facet.getField().equals("publisher"))
                .singleElement()
                .satisfies((facet) -> assertThat(facet.getValues()).isNotEmpty());
        assertThat(response.getFacets())
                .filteredOn((facet) -> facet.getField().equals("sourceSystem"))
                .singleElement()
                .satisfies((facet) -> assertThat(facet.getValues())
                        .extracting(FacetValue::getValue)
                        .contains("CENSUS", "USGS"));
    }

    @Test
    void multiWordQueryMatchesWithoutTheExactPhrase() {
        SearchResponse response = searchService.search("North Dakota workforce", List.of(), null, null, null, 0, 25);

        assertThat(response.getResults())
                .extracting(SearchResult::getId)
                .contains("lodes-wac-north-dakota-2023");
    }

    @Test
    void unrelatedTermsDoNotMatchOnASingleWord() {
        SearchResponse response = searchService.search(
                "Wyoming hydrography earthquake census", List.of(), null, null, null, 0, 25);

        assertThat(response.getResults())
                .extracting(SearchResult::getGeography)
                .doesNotContain("California");
    }

    @Test
    void singleTermQueryStillRequiresTheTerm() {
        SearchResponse response = searchService.search("Wyoming", List.of(), null, null, null, 0, 25);

        assertThat(response.getResults()).isNotEmpty();
        assertThat(response.getResults()).allSatisfy((result) -> assertThat(
                        (result.getTitle() + " " + result.getGeography()).toLowerCase())
                .contains("wyoming"));
    }

    @Test
    void vintageFacetIsOfferedNewestFirst() {
        SearchResponse response = searchService.search(null, List.of(), null, null, null, 0, 25);

        assertThat(response.getFacets())
                .extracting(org.civicsrepo.generated.dto.FacetGroup::getField)
                .contains("vintageYear");

        List<String> years = response.getFacets().stream()
                .filter((facet) -> "vintageYear".equals(facet.getField()))
                .findFirst()
                .orElseThrow()
                .getValues()
                .stream()
                .map(FacetValue::getValue)
                .toList();

        assertThat(years).isSortedAccordingTo((left, right) -> right.compareTo(left));
    }
}
