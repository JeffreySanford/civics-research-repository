package org.civicsrepo.admin;

import static org.mockito.BDDMockito.given;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import org.civicsrepo.generated.dto.CorpusProfile;
import org.civicsrepo.generated.dto.CorpusProfileSummary;
import org.civicsrepo.generated.dto.CorpusStorageMeasurement;
import org.civicsrepo.generated.dto.CorpusStorageOverview;
import org.civicsrepo.generated.dto.DeploymentTopology;
import org.civicsrepo.generated.dto.DspaceContainerSummary;
import org.civicsrepo.generated.dto.DspaceOverview;
import org.civicsrepo.generated.dto.RepositorySource;
import org.civicsrepo.generated.dto.SolrOverview;
import org.civicsrepo.generated.dto.SyncSource;
import org.civicsrepo.generated.dto.SyncStatus;
import org.civicsrepo.repository.RepositoryIdentityStore;
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
    private CorpusStorageAdminService corpusStorageAdminService;

    @MockitoBean
    private RepositoryIdentityStore repositoryIdentityStore;

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
    void returnsCorpusStorageOverviewAndCapturesCurrentProfile() throws Exception {
        CorpusStorageMeasurement measurement = new CorpusStorageMeasurement(
                "measurement-1",
                CorpusProfile.CURATED_DEMO,
                DeploymentTopology.DOCKER_COMPOSE,
                181L,
                0L,
                102_000L,
                OffsetDateTime.parse("2026-08-29T23:30:00Z"))
                .applicationPostgresBytes(12_000L)
                .dspaceStoredBytes(34_000L)
                .solrIndexBytes(56_000L);
        CorpusStorageOverview overview = new CorpusStorageOverview(
                CorpusProfile.CURATED_DEMO,
                List.of(
                        new CorpusProfileSummary(CorpusProfile.CURATED_DEMO, "Curated demo", true)
                                .latestMeasurement(measurement),
                        new CorpusProfileSummary(CorpusProfile.FEDERATED_1M, "Federated 1M", false)
                                .targetFederatedRecordCount(1_000_000L)),
                List.of(measurement));
        given(corpusStorageAdminService.overview()).willReturn(overview);
        given(corpusStorageAdminService.captureCurrent()).willReturn(measurement);

        mockMvc.perform(get("/admin/corpus/storage"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.activeProfile").value("CURATED_DEMO"))
                .andExpect(jsonPath("$.profiles[1].targetFederatedRecordCount").value(1_000_000))
                .andExpect(jsonPath("$.history[0].totalMeasuredLocalBytes").value(102_000));

        mockMvc.perform(post("/admin/corpus/storage/capture"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.profile").value("CURATED_DEMO"))
                .andExpect(jsonPath("$.openSearchIndexBytes").doesNotExist());
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
