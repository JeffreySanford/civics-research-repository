package org.civicsrepo.admin;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.BDDMockito.given;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.civicsrepo.dspace.DspaceRestClient;
import org.civicsrepo.generated.dto.ResearchProgram;
import org.civicsrepo.generated.dto.RepositorySource;
import org.civicsrepo.generated.dto.SyncAction;
import org.civicsrepo.generated.dto.SyncJob;
import org.civicsrepo.generated.dto.SyncMode;
import org.civicsrepo.generated.dto.SyncSource;
import org.civicsrepo.generated.dto.SyncStatus;
import org.civicsrepo.repository.DiscoveryProjectionService;
import org.civicsrepo.repository.DiscoveryProjectionService.ProjectionState;
import org.civicsrepo.search.DiscoveryIndex;
import org.civicsrepo.sync.SyncService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class AdminOverviewServiceTest {
    private static final UUID JOB_ID = UUID.fromString("00000000-0000-4000-8000-000000000001");

    @Mock
    private DspaceRestClient dspaceRestClient;

    @Mock
    private DiscoveryIndex discoveryIndex;

    @Mock
    private DiscoveryProjectionService discoveryProjectionService;

    @Mock
    private SyncService syncService;

    @InjectMocks
    private AdminOverviewService adminOverviewService;

    @Test
    void buildsDspaceOverviewWhenRepositoryIsReachable() {
        given(syncService.findRecentJobs())
                .willReturn(List.of(new SyncJob(
                        JOB_ID,
                        SyncMode.APPLY,
                        SyncSource.TIGER_LINE,
                        SyncStatus.APPLIED,
                        OffsetDateTime.parse("2026-08-11T19:00:00Z"),
                        List.of(new SyncAction(
                                SyncAction.ActionTypeEnum.UPSERT_ITEM, "Demo item", "Upsert metadata.")))));
        given(dspaceRestClient.isReachable()).willReturn(true);
        given(dspaceRestClient.isReadEnabled()).willReturn(true);
        given(dspaceRestClient.isWriteEnabled()).willReturn(true);
        given(dspaceRestClient.baseUrl()).willReturn("http://localhost:8081/server");
        given(dspaceRestClient.listCommunities())
                .willReturn(List.of(new DspaceRestClient.ContainerSummary(
                        "11111111-1111-4111-8111-111111111111", "Census Public Research Data")));
        given(dspaceRestClient.listCollections())
                .willReturn(List.of(new DspaceRestClient.ContainerSummary(
                        "22222222-2222-4222-8222-222222222222", "TIGER/Line Geospatial Files")));
        given(dspaceRestClient.countDiscoverableItems()).willReturn(Optional.of(2));
        given(discoveryIndex.programFacetCounts())
                .willReturn(Map.of(ResearchProgram.TIGER_LINE, 2));

        var overview = adminOverviewService.dspaceOverview();

        assertThat(overview.getReachable()).isTrue();
        assertThat(overview.getItemCount()).isEqualTo(2);
        assertThat(overview.getCommunities()).hasSize(1);
        assertThat(overview.getLastSyncStatus()).isEqualTo(SyncStatus.APPLIED);
        assertThat(overview.getStoredMetadataFields()).contains("crr.program");
        assertThat(overview.getRecentSyncActionSummary()).singleElement().satisfies((summary) -> {
            assertThat(summary.getActionType()).isEqualTo("UPSERT_ITEM");
            assertThat(summary.getCount()).isEqualTo(1);
        });
        assertThat(overview.getProgramCounts()).singleElement().satisfies((count) -> {
            assertThat(count.getProgram()).isEqualTo(ResearchProgram.TIGER_LINE);
            assertThat(count.getCount()).isEqualTo(2);
        });
    }

    @Test
    void reportsDisabledDspaceReadsWithoutCallingTheRepository() {
        given(syncService.findRecentJobs()).willReturn(List.of());
        given(dspaceRestClient.isReachable()).willReturn(false);
        given(dspaceRestClient.isReadEnabled()).willReturn(false);
        given(dspaceRestClient.isWriteEnabled()).willReturn(false);

        var overview = adminOverviewService.dspaceOverview();

        assertThat(overview.getStatusMessage()).contains("disabled");
    }

    @Test
    void buildsSolrOverviewWithProjectionMetadata() {
        given(discoveryIndex.isEnabled()).willReturn(true);
        given(discoveryIndex.isReachable()).willReturn(true);
        given(discoveryIndex.baseUrl()).willReturn("http://localhost:8983/solr");
        given(discoveryIndex.indexName()).willReturn("discovery");
        given(discoveryIndex.documentCount()).willReturn(Optional.of(4));
        given(discoveryProjectionService.state())
                .willReturn(new ProjectionState(
                        RepositorySource.REPOSITORY, 4, OffsetDateTime.parse("2026-08-11T19:00:05Z")));
        given(dspaceRestClient.isReadEnabled()).willReturn(true);
        given(dspaceRestClient.isReachable()).willReturn(true);
        given(dspaceRestClient.countDiscoverableItems()).willReturn(Optional.of(4));

        var overview = adminOverviewService.solrOverview();

        assertThat(overview.getIndexedDocumentCount()).isEqualTo(4);
        assertThat(overview.getProjectionSource()).isEqualTo(RepositorySource.REPOSITORY);
        assertThat(overview.getLastRebuiltAt()).isEqualTo(OffsetDateTime.parse("2026-08-11T19:00:05Z"));
        assertThat(overview.getProjectionBreakdown()).satisfies((breakdown) -> {
            assertThat(breakdown.getIndexedCount()).isEqualTo(4);
            assertThat(breakdown.getProjectedCount()).isEqualTo(4);
            assertThat(breakdown.getRepositoryItemCount()).isEqualTo(4);
            assertThat(breakdown.getSource()).isEqualTo(RepositorySource.REPOSITORY);
        });
    }
}
