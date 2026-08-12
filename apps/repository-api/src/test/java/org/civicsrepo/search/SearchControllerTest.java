package org.civicsrepo.search;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.List;
import org.civicsrepo.repository.RepositorySource;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(SearchController.class)
class SearchControllerTest {
    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private SearchService searchService;

    @Test
    void appliesPagingDefaultsWhenNoParametersAreSupplied() throws Exception {
        given(searchService.search(any(), anyList(), any(), any(), eq(0), eq(25))).willReturn(response());

        mockMvc.perform(get("/search"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.resultSource").value("REPOSITORY"))
                .andExpect(jsonPath("$.totalResults").value(1))
                .andExpect(jsonPath("$.results[0].id").value("tiger-line-north-dakota-2025"));

        verify(searchService).search(null, List.of(), null, null, 0, 25);
    }

    @Test
    void bindsEveryFilterParameter() throws Exception {
        given(searchService.search(
                        eq("tracts"),
                        eq(List.of(ResearchProgram.TIGER_LINE)),
                        eq("North Dakota"),
                        eq(2025),
                        eq(2),
                        eq(10)))
                .willReturn(response());

        mockMvc.perform(get("/search")
                        .param("q", "tracts")
                        .param("program", "TIGER_LINE")
                        .param("geography", "North Dakota")
                        .param("vintageYear", "2025")
                        .param("page", "2")
                        .param("pageSize", "10"))
                .andExpect(status().isOk());

        verify(searchService)
                .search("tracts", List.of(ResearchProgram.TIGER_LINE), "North Dakota", 2025, 2, 10);
    }

    /** Repeating the parameter selects several programs; results match any of them. */
    @Test
    void bindsARepeatedProgramParameter() throws Exception {
        given(searchService.search(
                        any(),
                        eq(List.of(ResearchProgram.TIGER_LINE, ResearchProgram.LODES, ResearchProgram.ACS)),
                        any(),
                        any(),
                        anyInt(),
                        anyInt()))
                .willReturn(response());

        mockMvc.perform(get("/search")
                        .param("program", "TIGER_LINE")
                        .param("program", "LODES")
                        .param("program", "ACS"))
                .andExpect(status().isOk());

        verify(searchService)
                .search(
                        null,
                        List.of(ResearchProgram.TIGER_LINE, ResearchProgram.LODES, ResearchProgram.ACS),
                        null,
                        null,
                        0,
                        25);
    }

    @Test
    void rejectsAnUnknownProgramFacet() throws Exception {
        mockMvc.perform(get("/search").param("program", "NOT_A_PROGRAM"))
                .andExpect(status().isBadRequest());

        verify(searchService, never()).search(any(), anyList(), any(), any(), anyInt(), anyInt());
    }

    @Test
    void rejectsANonNumericVintageYear() throws Exception {
        mockMvc.perform(get("/search").param("vintageYear", "recent"))
                .andExpect(status().isBadRequest());
    }

    /**
     * A quote in a geography value must reach the service unaltered; escaping is the Solr client's
     * job, and doing it earlier would corrupt legitimate values.
     */
    @Test
    void passesQuotedGeographyValuesThroughUnchanged() throws Exception {
        given(searchService.search(any(), anyList(), eq("North \"Dakota\""), any(), anyInt(), anyInt()))
                .willReturn(response());

        mockMvc.perform(get("/search").param("geography", "North \"Dakota\""))
                .andExpect(status().isOk());

        verify(searchService).search(null, List.of(), "North \"Dakota\"", null, 0, 25);
    }

    private SearchResponse response() {
        return new SearchResponse(
                RepositorySource.REPOSITORY,
                "",
                0,
                25,
                1,
                List.of(new SearchResult(
                        "tiger-line-north-dakota-2025",
                        "2025 TIGER/Line - Census Tracts - North Dakota",
                        ResearchObjectType.DATASET,
                        ResearchProgram.TIGER_LINE,
                        "U.S. Census Bureau",
                        "Tract geometry metadata.",
                        "North Dakota",
                        2025,
                        "https://www2.census.gov/geo/tiger/TIGER2025/")),
                List.of());
    }
}
