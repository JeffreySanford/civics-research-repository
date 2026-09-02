package org.civicsrepo.search;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
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
import org.springframework.http.HttpStatus;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.server.ResponseStatusException;

@WebMvcTest(SearchController.class)
class SearchControllerTest {
    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private SearchService searchService;

    @MockitoBean
    private SearchCursorService searchCursorService;

    @Test
    void acceptsADataDrivenProgramOutsideTheLegacyEnum() throws Exception {
        given(searchService.search(
                        any(),
                        eq(List.of("Office of Science")),
                        any(),
                        any(),
                        any(),
                        any(),
                        any(),
                        anyInt(),
                        anyInt()))
                .willReturn(response());

        mockMvc.perform(get("/search").param("program", "Office of Science"))
                .andExpect(status().isOk());

        verify(searchService)
                .search(
                        any(),
                        eq(List.of("Office of Science")),
                        any(),
                        any(),
                        any(),
                        any(),
                        any(),
                        anyInt(),
                        anyInt());
    }

    @Test
    void appliesPagingDefaultsWhenNoParametersAreSupplied() throws Exception {
        given(searchService.search(any(), anyList(), any(), any(), any(), any(), any(), eq(0), eq(25)))
                .willReturn(response());

        mockMvc.perform(get("/search"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.resultSource").value("REPOSITORY"))
                .andExpect(jsonPath("$.totalResults").value(1))
                .andExpect(jsonPath("$.results[0].id").value("tiger-line-north-dakota-2025"))
                .andExpect(jsonPath("$.results[0].origin").value("REPOSITORY"))
                .andExpect(jsonPath("$.results[0].sourceSystem").value("CENSUS"));

        verify(searchService).search(null, List.of(), null, null, null, null, null, 0, 25);
    }

    @Test
    void bindsEveryFilterParameter() throws Exception {
        given(searchService.search(
                        eq("tracts"),
                        eq(List.of("TIGER_LINE")),
                        eq("U.S. Census Bureau"),
                        eq(SourceSystem.CENSUS),
                        eq("North Dakota"),
                        any(),
                        eq(2025),
                        eq(2),
                        eq(10)))
                .willReturn(response());

        mockMvc.perform(get("/search")
                        .param("q", "tracts")
                        .param("program", "TIGER_LINE")
                        .param("publisher", "U.S. Census Bureau")
                        .param("sourceSystem", "CENSUS")
                        .param("geography", "North Dakota")
                        .param("vintageYear", "2025")
                        .param("page", "2")
                        .param("pageSize", "10"))
                .andExpect(status().isOk());

        verify(searchService)
                .search(
                        "tracts",
                        List.of("TIGER_LINE"),
                        "U.S. Census Bureau",
                        SourceSystem.CENSUS,
                        "North Dakota",
                        null,
                        2025,
                        2,
                        10);
    }

    @Test
    void bindsARepeatedProgramParameter() throws Exception {
        given(searchService.search(
                        any(),
                        eq(List.of("TIGER_LINE", "LODES", "Office of Science")),
                        any(),
                        any(),
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
        given(searchService.search(
                        any(),
                        anyList(),
                        any(),
                        any(),
                        eq("North \"Dakota\""),
                        any(),
                        any(),
                        anyInt(),
                        anyInt()))
                .willReturn(response());

        mockMvc.perform(get("/search").param("geography", "North \"Dakota\""))
                .andExpect(status().isOk());

        verify(searchService)
                .search(null, List.of(), null, null, "North \"Dakota\"", null, null, 0, 25);
    }

    @Test
    void exposesCursorTraversalWithoutChangingTheOffsetEndpoint() throws Exception {
        given(searchCursorService.search(
                        eq("climate"),
                        eq(List.of("Office of Science")),
                        eq("DOE Office of Scientific and Technical Information"),
                        eq(SourceSystem.DOE_OSTI),
                        eq("North Dakota"),
                        eq(ResearchObjectType.PUBLICATION),
                        eq(2025),
                        eq("opaque-current"),
                        eq(10)))
                .willReturn(new SearchCursorPage(response(), "opaque-next"));

        mockMvc.perform(get("/search/cursor")
                        .param("q", "climate")
                        .param("program", "Office of Science")
                        .param("publisher", "DOE Office of Scientific and Technical Information")
                        .param("sourceSystem", "DOE_OSTI")
                        .param("geography", "North Dakota")
                        .param("contentType", "PUBLICATION")
                        .param("vintageYear", "2025")
                        .param("cursor", "opaque-current")
                        .param("pageSize", "10"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.search.resultSource").value("REPOSITORY"))
                .andExpect(jsonPath("$.nextCursor").value("opaque-next"));

        verify(searchCursorService)
                .search(
                        "climate",
                        List.of("Office of Science"),
                        "DOE Office of Scientific and Technical Information",
                        SourceSystem.DOE_OSTI,
                        "North Dakota",
                        ResearchObjectType.PUBLICATION,
                        2025,
                        "opaque-current",
                        10);
    }

    @Test
    void returnsTypedBadRequestForInvalidCursor() throws Exception {
        given(searchCursorService.search(any(), anyList(), any(), any(), any(), any(), any(), any(), anyInt()))
                .willThrow(new SearchCursorException("Search cursor signature is not valid."));

        mockMvc.perform(get("/search/cursor").param("cursor", "edited"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("BAD_REQUEST"))
                .andExpect(jsonPath("$.message").value("Search cursor signature is not valid."));
    }

    @Test
    void reportsMissingCursorServiceAsServiceUnavailable() {
        SearchController controller = new SearchController(searchService);

        assertThatThrownBy(() -> controller.searchResearchObjectsWithCursor(
                        null, null, null, null, null, null, null, null, 25))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(exception -> assertThat(((ResponseStatusException) exception).getStatusCode())
                        .isEqualTo(HttpStatus.SERVICE_UNAVAILABLE))
                .hasMessageContaining("Cursor search service is not configured");
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
