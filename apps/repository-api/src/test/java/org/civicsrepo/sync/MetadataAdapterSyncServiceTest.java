package org.civicsrepo.sync;

import org.civicsrepo.generated.dto.SyncAction;
import org.civicsrepo.generated.dto.SyncJob;
import org.civicsrepo.generated.dto.SyncMode;
import org.civicsrepo.generated.dto.SyncRequest;
import org.civicsrepo.generated.dto.SyncSource;
import org.civicsrepo.generated.dto.SyncStatus;
import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import org.civicsrepo.dspace.DspaceItemDiffPlanner;
import org.civicsrepo.dspace.DspaceItemPayloadMapper;
import org.civicsrepo.sources.CpsMetadataAdapter;
import org.civicsrepo.sources.LodesMetadataAdapter;
import org.civicsrepo.sources.OfflineSourceFileProbe;
import org.civicsrepo.sources.SippMetadataAdapter;
import org.civicsrepo.sources.TigerLineMetadataAdapter;
import org.civicsrepo.sources.UsgsEarthquakesMetadataAdapter;
import org.junit.jupiter.api.Test;

class MetadataAdapterSyncServiceTest {
    private final SyncService syncService = new SyncService(
            new InMemorySyncJobStore(),
            (request, actions, sourcePayload) -> {},
            new DspaceItemPayloadMapper(),
            new DspaceItemDiffPlanner((sourceIdentifier) -> java.util.Optional.empty()),
            List.of(
                    new TigerLineMetadataAdapter(new OfflineSourceFileProbe()),
                    new LodesMetadataAdapter(new OfflineSourceFileProbe()),
                    new CpsMetadataAdapter(new OfflineSourceFileProbe()),
                    new SippMetadataAdapter(new OfflineSourceFileProbe()),
                    new UsgsEarthquakesMetadataAdapter(new OfflineSourceFileProbe())));

    @Test
    void dryRunPlansRepositoryActionsForEachRegisteredAdapter() {
        assertDryRunCompletes(SyncSource.LODES, "lodes-wac-north-dakota-2023");
        assertDryRunCompletes(SyncSource.CPS, "cps-public-use-2026");
        assertDryRunCompletes(SyncSource.SIPP, "sipp-public-use-2025");
        assertDryRunCompletes(SyncSource.USGS_EARTHQUAKES, "usgs-earthquakes-overlay");
    }

    private void assertDryRunCompletes(SyncSource source, String expectedManifestTarget) {
        SyncJob job = syncService.runSync(new SyncRequest(SyncMode.DRY_RUN, source));

        assertThat(job.getStatus()).isEqualTo(SyncStatus.DRY_RUN_COMPLETE);
        assertThat(job.getActions())
                .extracting(SyncAction::getActionType)
                .contains(SyncAction.ActionTypeEnum.UPSERT_ITEM, SyncAction.ActionTypeEnum.UPSERT_FILE_MANIFEST);
        assertThat(job.getActions())
                .filteredOn(action -> action.getActionType() == SyncAction.ActionTypeEnum.UPSERT_FILE_MANIFEST)
                .extracting(SyncAction::getTarget)
                .contains(expectedManifestTarget);
    }

    private static final class InMemorySyncJobStore implements SyncJobStore {
        private final java.util.List<SyncJob> jobs = new java.util.ArrayList<>();

        @Override
        public SyncJob save(SyncJob job) {
            jobs.removeIf((existing) -> existing.getId().equals(job.getId()));
            jobs.add(0, job);
            return job;
        }

        @Override
        public java.util.Optional<SyncJob> findById(java.util.UUID id) {
            return jobs.stream().filter((job) -> job.getId().equals(id)).findFirst();
        }

        @Override
        public List<SyncJob> findRecent(int limit) {
            return jobs.stream().limit(limit).toList();
        }
    }
}
