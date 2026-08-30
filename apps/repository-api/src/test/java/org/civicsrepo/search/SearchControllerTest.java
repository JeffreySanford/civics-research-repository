package org.civicsrepo.search;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.net.URI;
import java.util.List;
import org.civicsrepo.generated.dto.RepositorySource;
import org.civicsrepo.generated.dto.ResearchObjectOrigin;
import org.civicsrepo.generated.dto.ResearchObjectType;
import org.civicsrepo.generated.dto.ResearchProgram;
import org.civicsrepo.generated.dto.SearchResponse;
import org.civicsrepo.generated.dto.SearchResult;
import org.civicsrepo.generated.dto.SourceSystem;
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
    void acceptsADataDrivenProgramOutsideTheLegacyEnum() throws Exception {
        given(searchService.search(
                        any(), eq(List.of("Office of Science")), any(), any(), any(), anyInt(), anyInt()))
                .willReturn(response());

        mockMvc.perform(get("/search").param("program", "Office of Science"))
                .andExpect(status().isOk());

        verify(searchService).search(any(), eq(List.of("Office of Science")), any(), any(), any(), anyInt(), anyInt());
    }

    @Test
    void appliesPagingDefaultsWhenNoParametersAreSupplied() throws Exception {
        given(searchService.search(any(), anyList(), any(), any(), any(), eq(0), eq(25))).willReturn(response());

        mockMvc.perform(get("/search"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.resultSource").value("REPOSITORY"))
                .andExpect(jsonPath("$.totalResults").value(1))
                .andExpect(jsonPath("$.results[0].id").value("tiger-line-north-dakota-2025"))
                .andExpect(jsonPath("$.results[0].origin").value("REPOSITORY"))
                .andExpect(jsonPath("$.results[0].sourceSystem").value("CENSUS"));

        verify(searchService).search(null, List.of(), null, null, null, 0, 25);
    }

    @Test
    void bindsEveryFilterParameter() throws Exception {
        given(searchService.search(
                        eq("tracts"),
                        eq(List.of("TIGER_LINE")),
                        eq("North Dakota"),
                        any(),
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

        verify(searchService).search("tracts", List.of("TIGER_LINE"), "North Dakota", null, 2025, 2, 10);
    }

    @Test
    void bindsARepeatedProgramParameter() throws Exception {
        given(searchService.search(
                        any(),
                        eq(List.of("TIGER_LINE", "LODES", "Office of Science")),
                        any(),
                        any(),
                        any(),
                        anyInt(),
                        anyInt()))
                .willReturn(response());

        mockMvc.perform(get("/search")
                        .param("program", "TIGER_LINE")
                        .param("program", "LODES")
                        .param("program", "Office of Science"))
                .andExpect(status().isOk());

        verify(searchService)
                .search(
                        null,
                        List.of("TIGER_LINE", "LODES", "Office of Science"),
                        null,
                        null,
                        null,
                        0,
                        25);
    }

    @Test
    void rejectsANonNumericVintageYear() throws Exception {
        mockMvc.perform(get("/search").param("vintageYear", "recent"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void passesQuotedGeographyValuesThroughUnchanged() throws Exception {
        given(searchService.search(any(), anyList(), eq("North \"Dakota\""), any(), any(), anyInt(), anyInt()))
                .willReturn(response());

        mockMvc.perform(get("/search").param("geography", "North \"Dakota\""))
                .andExpect(status().isOk());

        verify(searchService).search(null, List.of(), "North \"Dakota\"", null, null, 0, 25);
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
                                URI.create("https://www2.census.gov/geo/tiger/TIGER2025/"),
                                ResearchObjectOrigin.REPOSITORY,
                                SourceSystem.CENSUS)
                        .programName("TIGER_LINE")
                        .geography("North Dakota")
                        .vintageYear(2025)),
                List.of());
    }
}
