package org.civicsrepo.federation;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.Test;

class FederatedHarvestProgressListenerTest {
    @Test
    void reportsEachPageOnlyAfterItsRunStateIsDurable() {
        FederatedHarvestService harvestService = mock(FederatedHarvestService.class);
        HarvestCheckpointStore checkpointStore = mock(HarvestCheckpointStore.class);
        InMemoryRunStore runStore = new InMemoryRunStore();
        FederatedSourceHarvester harvester = mock(FederatedSourceHarvester.class);
        when(harvester.sourceSystem()).thenReturn(FederatedSourceSystem.DATA_GOV);
        when(harvester.adapterVersion()).thenReturn("data-gov-test-v1");
        when(checkpointStore.find(FederatedSourceSystem.DATA_GOV)).thenReturn(Optional.empty());
        when(harvestService.harvestNext(FederatedSourceSystem.DATA_GOV, 100, anyString()))
                .thenReturn(new FederatedHarvestService.HarvestResult(
                        FederatedSourceSystem.DATA_GOV,
                        100,
                        0,
                        100,
                        false,
                        "cursor-100",
                        List.of()))
                .thenReturn(new FederatedHarvestService.HarvestResult(
                        FederatedSourceSystem.DATA_GOV,
                        100,
                        0,
                        200,
                        false,
                        "cursor-200",
                        List.of()));

        FederatedHarvestRunService service = new FederatedHarvestRunService(
                harvestService,
                runStore,
                checkpointStore,
                List.of(harvester),
                Clock.fixed(Instant.parse("2026-08-31T00:30:00Z"), ZoneOffset.UTC));
        List<Long> reportedAcceptedCounts = new ArrayList<>();

        HarvestRun paused = service.runBounded(
                FederatedSourceSystem.DATA_GOV,
                100,
                2,
                run -> {
                    assertThat(runStore.findById(run.id())).contains(run);
                    reportedAcceptedCounts.add(run.acceptedCount());
                });

        assertThat(reportedAcceptedCounts).containsExactly(100L, 200L);
        assertThat(paused.status()).isEqualTo(HarvestRunStatus.PAUSED);
        assertThat(paused.acceptedCount()).isEqualTo(200);
    }

    private static final class InMemoryRunStore implements HarvestRunStore {
        private final Map<String, HarvestRun> runs = new HashMap<>();

        @Override
        public void save(HarvestRun run) {
            runs.put(run.id(), run);
        }

        @Override
        public Optional<HarvestRun> findById(String id) {
            return Optional.ofNullable(runs.get(id));
        }

        @Override
        public Optional<HarvestRun> findResumable(FederatedSourceSystem sourceSystem) {
            return runs.values().stream()
                    .filter(run -> run.sourceSystem() == sourceSystem)
                    .filter(run -> run.status() == HarvestRunStatus.RUNNING || run.status() == HarvestRunStatus.PAUSED)
                    .findFirst();
        }

        @Override
        public List<HarvestRun> findRecent(FederatedSourceSystem sourceSystem, int limit) {
            return runs.values().stream()
                    .filter(run -> run.sourceSystem() == sourceSystem)
                    .limit(limit)
                    .toList();
        }
    }
}
