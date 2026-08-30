package org.civicsrepo.federation;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.net.URI;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicBoolean;
import org.civicsrepo.generated.dto.ResearchObjectType;
import org.junit.jupiter.api.Test;

class FederatedHarvestRateLimitLifecycleTest {
    private static final Clock CLOCK =
            Clock.fixed(Instant.parse("2026-08-30T16:45:00Z"), ZoneOffset.UTC);

    @Test
    void pausesExhaustedTransientFailureAndResumesSameRunLater() {
        InMemoryCatalog catalog = new InMemoryCatalog();
        InMemoryCheckpointStore checkpoints = new InMemoryCheckpointStore();
        InMemoryRunStore runs = new InMemoryRunStore();
        AtomicBoolean rateLimited = new AtomicBoolean(true);
        FederatedSourceHarvester harvester = new FederatedSourceHarvester() {
            @Override
            public FederatedSourceSystem sourceSystem() {
                return FederatedSourceSystem.DATA_GOV;
            }

            @Override
            public String adapterVersion() {
                return "test-v2";
            }

            @Override
            public HarvestPage fetch(String cursor, int pageSize) {
                if (rateLimited.get()) {
                    throw FederatedHarvestException.retryable(
                            "Data.gov Catalog API returned HTTP 429.", Duration.ofHours(1));
                }
                return new HarvestPage(List.of(record("001")), null, true);
            }
        };
        FederatedHarvestService pageService = new FederatedHarvestService(
                catalog, checkpoints, List.of(harvester), (duration) -> {}, () -> 1.0);
        FederatedHarvestRunService service =
                new FederatedHarvestRunService(pageService, runs, checkpoints, List.of(harvester), CLOCK);

        HarvestRun paused = service.runBounded(FederatedSourceSystem.DATA_GOV, 100, 10);

        assertEquals(HarvestRunStatus.PAUSED, paused.status());
        assertEquals(0, paused.pageCount());
        assertEquals(0, paused.acceptedCount());
        assertNull(paused.cursor());
        assertNull(paused.completedAt());
        assertEquals("Data.gov Catalog API returned HTTP 429.", paused.failureMessage());
        assertEquals(paused.id(), runs.findResumable(FederatedSourceSystem.DATA_GOV).orElseThrow().id());
        assertTrue(catalog.records.isEmpty());

        rateLimited.set(false);
        HarvestRun completed = service.runBounded(FederatedSourceSystem.DATA_GOV, 100, 10);

        assertEquals(paused.id(), completed.id());
        assertEquals(HarvestRunStatus.COMPLETED, completed.status());
        assertEquals(1, completed.pageCount());
        assertEquals(1, completed.acceptedCount());
        assertNull(completed.failureMessage());
        assertTrue(runs.findResumable(FederatedSourceSystem.DATA_GOV).isEmpty());
        assertEquals(List.of("DATA_GOV:001"), catalog.records.stream()
                .map(FederatedResearchRecord::id)
                .toList());
    }

    private static FederatedResearchRecord record(String id) {
        return new FederatedResearchRecord(
                FederatedSourceSystem.DATA_GOV,
                id,
                "Title " + id,
                "Summary",
                "Publisher",
                "Program",
                ResearchObjectType.DATASET,
                URI.create("https://example.gov/" + id),
                null,
                OffsetDateTime.parse("2026-08-30T16:00:00Z"),
                "test-v2",
                List.of(),
                List.of(),
                Map.of());
    }

    private static final class InMemoryCatalog implements FederatedMetadataCatalog {
        private final List<FederatedResearchRecord> records = new ArrayList<>();

        @Override
        public void upsertBatch(List<FederatedResearchRecord> batch) {
            records.addAll(batch);
        }

        @Override
        public Optional<FederatedResearchRecord> findById(String id) {
            return records.stream().filter((record) -> record.id().equals(id)).findFirst();
        }

        @Override
        public List<FederatedResearchRecord> findAfterId(String afterId, int limit) {
            return records.stream()
                    .filter((record) -> afterId == null || record.id().compareTo(afterId) > 0)
                    .limit(limit)
                    .toList();
        }

        @Override
        public long count() {
            return records.size();
        }
    }

    private static final class InMemoryCheckpointStore implements HarvestCheckpointStore {
        private final Map<FederatedSourceSystem, HarvestCheckpoint> checkpoints =
                new EnumMap<>(FederatedSourceSystem.class);

        @Override
        public Optional<HarvestCheckpoint> find(FederatedSourceSystem sourceSystem) {
            return Optional.ofNullable(checkpoints.get(sourceSystem));
        }

        @Override
        public void save(HarvestCheckpoint checkpoint) {
            checkpoints.put(checkpoint.sourceSystem(), checkpoint);
        }

        @Override
        public void clear(FederatedSourceSystem sourceSystem) {
            checkpoints.remove(sourceSystem);
        }
    }

    private static final class InMemoryRunStore implements HarvestRunStore {
        private final Map<String, HarvestRun> runs = new LinkedHashMap<>();

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
                    .filter((run) -> run.sourceSystem() == sourceSystem && run.resumable())
                    .reduce((first, second) -> second);
        }

        @Override
        public List<HarvestRun> findRecent(FederatedSourceSystem sourceSystem, int limit) {
            return runs.values().stream()
                    .filter((run) -> run.sourceSystem() == sourceSystem)
                    .limit(limit)
                    .toList();
        }
    }
}
