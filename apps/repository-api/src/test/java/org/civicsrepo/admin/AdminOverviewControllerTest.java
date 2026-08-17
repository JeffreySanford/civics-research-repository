package org.civicsrepo.admin;

import static org.mockito.BDDMockito.given;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import org.civicsrepo.generated.dto.DspaceContainerSummary;
import org.civicsrepo.generated.dto.DspaceOverview;
import org.civicsrepo.generated.dto.RepositorySource;
import org.civicsrepo.generated.dto.SolrOverview;
import org.civicsrepo.generated.dto.SyncSource;
import org.civicsrepo.generated.dto.SyncStatus;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(AdminOverviewController.class)
class AdminOverviewControllerTest {
    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private AdminOverviewService adminOverviewService;

    @MockitoBean
    private SourceInventoryService sourceInventoryService;

    @Test
    void returnsDspaceOverview() throws Exception {
        given(adminOverviewService.dspaceOverview())
                .willReturn(new DspaceOverview(true, true, false)
                        .baseUrl("http://localhost:8081/server")
                        .itemCount(3)
                        .communityCount(1)
                        .collectionCount(1)
                        .communities(List.of(new DspaceContainerSummary("Census Public Research Data")
                                .uuid(UUID.fromString("11111111-1111-4111-8111-111111111111"))))
                        .collections(List.of(new DspaceContainerSummary("TIGER/Line Geospatial Files")
                                .uuid(UUID.fromString("22222222-2222-4222-8222-222222222222"))))
                        .lastSyncStatus(SyncStatus.APPLIED)
                        .lastSyncSource(SyncSource.TIGER_LINE)
                        .lastSyncStartedAt(OffsetDateTime.parse("2026-08-11T19:00:00Z")));

        mockMvc.perform(get("/admin/dspace/overview"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.reachable").value(true))
                .andExpect(jsonPath("$.itemCount").value(3))
                .andExpect(jsonPath("$.communities[0].name").value("Census Public Research Data"))
                .andExpect(jsonPath("$.lastSyncStatus").value("APPLIED"));
    }

    @Test
    void returnsSolrOverview() throws Exception {
        given(adminOverviewService.solrOverview())
                .willReturn(new SolrOverview(true, true)
                        .baseUrl("http://localhost:8983/solr")
                        .core("discovery")
                        .indexedDocumentCount(3)
                        .projectionSource(RepositorySource.REPOSITORY)
                        .projectionObjectCount(3)
                        .lastRebuiltAt(OffsetDateTime.parse("2026-08-11T19:00:05Z")));

        mockMvc.perform(get("/admin/solr/overview"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.reachable").value(true))
                .andExpect(jsonPath("$.indexedDocumentCount").value(3))
                .andExpect(jsonPath("$.projectionSource").value("REPOSITORY"));
    }
}
