package org.civicsrepo.sync;

import org.civicsrepo.generated.dto.SyncAction;
import org.civicsrepo.sources.OfflineSourceFileProbe;
import org.civicsrepo.generated.dto.SyncJob;
import org.civicsrepo.generated.dto.SyncMode;
import org.civicsrepo.generated.dto.SyncRequest;
import org.civicsrepo.generated.dto.SyncSource;
import org.civicsrepo.generated.dto.SyncStatus;
import static org.assertj.core.api.Assertions.assertThat;

import java.util.ArrayList;
import java.util.UUID;
import java.util.List;
import java.util.Optional;
import org.civicsrepo.dspace.DspaceDiscoveryItemStateReader;
import org.civicsrepo.dspace.DspaceItemDiffPlanner;
import org.civicsrepo.dspace.DspaceItemPayloadMapper;
import org.civicsrepo.dspace.DspaceRestClient;
import org.civicsrepo.sources.TigerLineMetadataAdapter;
import org.junit.jupiter.api.Test;

/**
 * Startup must not narrate repository work it did not do.
 *
 * <p>The previous behavior ran a DRY_RUN unconditionally and logged seven {@code UPSERT_*} actions
 * against a DSpace that was not running in the default Compose profile.
 */
class StartupSyncRunnerTest {
    private static final String UNREACHABLE = "http://localhost:1/server";

    private final TestSyncJobStore store = new TestSyncJobStore();
    private final SyncService syncService = new SyncService(
            store,
            (request, actions, sourcePayload) -> {},
            new DspaceItemPayloadMapper(),
            new DspaceItemDiffPlanner((sourceIdentifier) -> Optional.empty()),
            List.of(new TigerLineMetadataAdapter(new OfflineSourceFileProbe())));

    @Test
    void skipsWhenDspaceIsConfiguredButNotRunning() {
        runner(new DspaceRestClient(UNREACHABLE, "admin@civics.local", "secret"), true, false).run();

        assertThat(store.jobs).isEmpty();
    }

    @Test
    void skipsWhenNoDspaceEndpointIsConfigured() {
        runner(new DspaceRestClient("", "", ""), true, false).run();

        assertThat(store.jobs).isEmpty();
    }

    @Test
    void skipsWhenStartupSyncIsDisabled() {
        runner(new DspaceRestClient(UNREACHABLE, "", ""), false, false).run();

        assertThat(store.jobs).isEmpty();
    }

    @Test
    void skipsWhenCliSyncOwnsTheRun() {
        runner(new DspaceRestClient(UNREACHABLE, "", ""), true, true).run();

        assertThat(store.jobs).isEmpty();
    }

    /**
     * DIFF planning reads live DSpace state. When that read fails the caller must still receive a
     * failed job carrying the reason, not an unhandled exception surfacing as HTTP 500.
     */
    @Test
    void diffAgainstAnUnreachableDspaceProducesAFailedJobRatherThanAnException() {
        SyncService liveService = new SyncService(
                store,
                (request, actions, sourcePayload) -> {},
                new DspaceItemPayloadMapper(),
                new DspaceItemDiffPlanner(
                        new DspaceDiscoveryItemStateReader(new DspaceRestClient(UNREACHABLE, "", ""))),
                List.of(new TigerLineMetadataAdapter(new OfflineSourceFileProbe())));

        SyncJob job = liveService.runSync(new SyncRequest(SyncMode.DIFF, SyncSource.TIGER_LINE));

        assertThat(job.getStatus()).isEqualTo(SyncStatus.FAILED);
        assertThat(job.getActions())
                .anySatisfy((action) -> {
                    assertThat(action.getActionType()).isEqualTo(SyncAction.ActionTypeEnum.SYNC_FAILED);
                    assertThat(action.getDetail()).contains(UNREACHABLE).contains("pnpm run dspace:up");
                });
    }

    private StartupSyncRunner runner(DspaceRestClient client, boolean startupEnabled, boolean cliEnabled) {
        return new StartupSyncRunner(
                new SyncProperties(startupEnabled, cliEnabled, SyncMode.APPLY, SyncSource.TIGER_LINE),
                syncService,
                client);
    }

    private static final class TestSyncJobStore implements SyncJobStore {
        private final List<SyncJob> jobs = new ArrayList<>();

        @Override
        public SyncJob save(SyncJob job) {
            jobs.removeIf((existingJob) -> existingJob.getId().equals(job.getId()));
            jobs.add(0, job);
            return job;
        }

        @Override
        public Optional<SyncJob> findById(UUID id) {
            return jobs.stream().filter((job) -> job.getId().equals(id)).findFirst();
        }

        @Override
        public List<SyncJob> findRecent(int limit) {
            return jobs.stream().limit(limit).toList();
        }
    }
}
