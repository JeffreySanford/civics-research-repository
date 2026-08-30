package org.civicsrepo.federation;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.net.URI;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicInteger;
import org.civicsrepo.generated.dto.ResearchObjectType;
import org.junit.jupiter.api.Test;

class FederatedHarvestServiceTest {
    @Test
    void resumesFromCheckpointAndClearsItWhenSourceCompletes() {
        InMemoryCatalog catalog = new InMemoryCatalog();
        InMemoryCheckpointStore checkpoints = new InMemoryCheckpointStore();
        TestHarvester harvester = new TestHarvester();
        FederatedHarvestService service = new FederatedHarvestService(catalog, checkpoints, List.of(harvester));

        FederatedHarvestService.HarvestResult first = service.harvestNext(FederatedSourceSystem.DATA_GOV, 2);
        assertEquals(2, first.acceptedThisPage());
        assertEquals(0, first.rejectedThisPage());
        assertEquals(2, first.totalAccepted());
        assertEquals("page-2", first.nextCursor());
        assertEquals("page-2", checkpoints.find(FederatedSourceSystem.DATA_GOV).orElseThrow().cursor());

        FederatedHarvestService.HarvestResult second = service.harvestNext(FederatedSourceSystem.DATA_GOV, 2);
        assertTrue(second.complete());
        assertEquals(3, second.totalAccepted());
        assertTrue(checkpoints.find(FederatedSourceSystem.DATA_GOV).isEmpty());
        assertEquals(List.of("DATA_GOV:001", "DATA_GOV:002", "DATA_GOV:003"), catalog.records.stream()
                .map(FederatedResearchRecord::id)
                .toList());
        assertEquals(2, harvester.seenCursors.size());
        assertNull(harvester.seenCursors.getFirst());
        assertEquals("page-2", harvester.seenCursors.get(1));
    }

    @Test
    void persistsRecordRejectionsWithRunIdAndStillAdvancesCheckpoint() {
        InMemoryCatalog catalog = new InMemoryCatalog();
        InMemoryCheckpointStore checkpoints = new InMemoryCheckpointStore();
        InMemoryQuarantineStore quarantine = new InMemoryQuarantineStore();
        FederatedSourceHarvester mixedPage = new FederatedSourceHarvester() {
            @Override
            public FederatedSourceSystem sourceSystem() {
                return FederatedSourceSystem.DATA_GOV;
            }

            @Override
            public HarvestPage fetch(String cursor, int pageSize) {
                return new HarvestPage(
                        List.of(record(FederatedSourceSystem.DATA_GOV, "accepted")),
                        List.of(new HarvestRejection("rejected", "missing required title", "{\"id\":\"rejected\"}")),
                        "source-offset-2",
                        false);
            }
        };
        FederatedHarvestService service = new FederatedHarvestService(
                catalog,
                checkpoints,
                quarantine,
                List.of(mixedPage),
                (duration) -> {},
                () -> 1.0);

        FederatedHarvestService.HarvestResult result =
                service.harvestNext(FederatedSourceSystem.DATA_GOV, 100, "run-123");

        assertEquals(1, result.acceptedThisPage());
        assertEquals(1, result.rejectedThisPage());
        assertEquals(1, result.totalAccepted());
        assertEquals("source-offset-2", result.nextCursor());
        assertEquals(1, catalog.records.size());
        assertEquals("source-offset-2", checkpoints.find(FederatedSourceSystem.DATA_GOV).orElseThrow().cursor());
        assertEquals(1, checkpoints.find(FederatedSourceSystem.DATA_GOV).orElseThrow().acceptedCount());
        assertEquals(1, quarantine.records.size());
        assertEquals("run-123", quarantine.records.getFirst().runId());
        assertEquals("rejected", quarantine.records.getFirst().sourceIdentifier());
        assertEquals("missing required title", quarantine.records.getFirst().message());
    }

    @Test
    void doesNotPersistQuarantineWithoutDurableRunId() {
        InMemoryCatalog catalog = new InMemoryCatalog();
        InMemoryCheckpointStore checkpoints = new InMemoryCheckpointStore();
        InMemoryQuarantineStore quarantine = new InMemoryQuarantineStore();
        FederatedSourceHarvester rejectedPage = new FederatedSourceHarvester() {
            @Override
            public FederatedSourceSystem sourceSystem() {
                return FederatedSourceSystem.DATA_GOV;
            }

            @Override
            public HarvestPage fetch(String cursor, int pageSize) {
                return new HarvestPage(
                        List.of(),
                        List.of(new HarvestRejection(null, "invalid record", "{}")),
                        null,
                        true);
            }
        };
        FederatedHarvestService service = new FederatedHarvestService(
                catalog,
                checkpoints,
                quarantine,
                List.of(rejectedPage),
                (duration) -> {},
                () -> 1.0);

        FederatedHarvestService.HarvestResult result =
                service.harvestNext(FederatedSourceSystem.DATA_GOV, 100);

        assertTrue(result.complete());
        assertEquals(1, result.rejectedThisPage());
        assertTrue(quarantine.records.isEmpty());
    }

    @Test
    void retriesTransientFailuresWithBoundedBackoff() {
        InMemoryCatalog catalog = new InMemoryCatalog();
        InMemoryCheckpointStore checkpoints = new InMemoryCheckpointStore();
        AtomicInteger attempts = new AtomicInteger();
        List<Duration> delays = new ArrayList<>();
        FederatedSourceHarvester flaky = new FederatedSourceHarvester() {
            @Override
            public FederatedSourceSystem sourceSystem() {
                return FederatedSourceSystem.DATA_GOV;
            }

            @Override
            public HarvestPage fetch(String cursor, int pageSize) {
                int attempt = attempts.incrementAndGet();
                if (attempt < 3) {
                    throw FederatedHarvestException.retryable("temporary upstream failure");
                }
                return new HarvestPage(List.of(record(FederatedSourceSystem.DATA_GOV, "001")), null, true);
            }
        };
        FederatedHarvestService service = new FederatedHarvestService(
                catalog, checkpoints, List.of(flaky), delays::add, () -> 1.0);

        FederatedHarvestService.HarvestResult result = service.harvestNext(FederatedSourceSystem.DATA_GOV, 100);

        assertTrue(result.complete());
        assertEquals(3, attempts.get());
        assertEquals(List.of(Duration.ofMillis(250), Duration.ofMillis(500)), delays);
        assertEquals(1, catalog.count());
    }

    @Test
    void honorsRetryAfterWithoutAllowingUnboundedSleep() {
        InMemoryCatalog catalog = new InMemoryCatalog();
        InMemoryCheckpointStore checkpoints = new InMemoryCheckpointStore();
        AtomicInteger attempts = new AtomicInteger();
        List<Duration> delays = new ArrayList<>();
        FederatedSourceHarvester rateLimited = new FederatedSourceHarvester() {
            @Override
            public FederatedSourceSystem sourceSystem() {
                return FederatedSourceSystem.DATA_GOV;
            }

            @Override
            public HarvestPage fetch(String cursor, int pageSize) {
                if (attempts.incrementAndGet() == 1) {
                    throw FederatedHarvestException.retryable("rate limited", Duration.ofSeconds(30));
                }
                return new HarvestPage(List.of(record(FederatedSourceSystem.DATA_GOV, "001")), null, true);
            }
        };
        FederatedHarvestService service = new FederatedHarvestService(
                catalog, checkpoints, List.of(rateLimited), delays::add, () -> 1.0);

        service.harvestNext(FederatedSourceSystem.DATA_GOV, 100);

        assertEquals(2, attempts.get());
        assertEquals(List.of(Duration.ofSeconds(5)), delays);
    }

    @Test
    void doesNotRetryPermanentFailures() {
        InMemoryCatalog catalog = new InMemoryCatalog();
        InMemoryCheckpointStore checkpoints = new InMemoryCheckpointStore();
        AtomicInteger attempts = new AtomicInteger();
        List<Duration> delays = new ArrayList<>();
        FederatedSourceHarvester invalidSource = new FederatedSourceHarvester() {
            @Override
            public FederatedSourceSystem sourceSystem() {
                return FederatedSourceSystem.DATA_GOV;
            }

            @Override
            public HarvestPage fetch(String cursor, int pageSize) {
                attempts.incrementAndGet();
                throw FederatedHarvestException.permanent("publisher response failed validation");
            }
        };
        FederatedHarvestService service = new FederatedHarvestService(
                catalog, checkpoints, List.of(invalidSource), delays::add, () -> 1.0);

        FederatedHarvestException failure = assertThrows(
                FederatedHarvestException.class,
                () -> service.harvestNext(FederatedSourceSystem.DATA_GOV, 100));

        assertEquals("publisher response failed validation", failure.getMessage());
        assertEquals(1, attempts.get());
        assertTrue(delays.isEmpty());
        assertTrue(catalog.records.isEmpty());
    }

    @Test
    void rejectsRecordsOwnedByAnotherSourceBeforePersistingThem() {
        InMemoryCatalog catalog = new InMemoryCatalog();
        InMemoryCheckpointStore checkpoints = new InMemoryCheckpointStore();
        FederatedSourceHarvester invalid = new FederatedSourceHarvester() {
            @Override
            public FederatedSourceSystem sourceSystem() {
                return FederatedSourceSystem.DATA_GOV;
            }

            @Override
            public HarvestPage fetch(String cursor, int pageSize) {
                return new HarvestPage(List.of(record(FederatedSourceSystem.DOE_OSTI, "wrong")), null, true);
            }
        };
        FederatedHarvestService service = new FederatedHarvestService(catalog, checkpoints, List.of(invalid));

        assertThrows(
                IllegalStateException.class,
                () -> service.harvestNext(FederatedSourceSystem.DATA_GOV, 100));
        assertTrue(catalog.records.isEmpty());
    }

    private static FederatedResearchRecord record(FederatedSourceSystem sourceSystem, String id) {
        return new FederatedResearchRecord(
                sourceSystem,
                id,
                "Title " + id,
                "Summary",
                "Publisher",
                "Program",
                ResearchObjectType.DATASET,
                URI.create("https://example.gov/" + id),
                null,
                OffsetDateTime.parse("2026-08-29T12:00:00Z"),
                "test-adapter",
                List.of(),
                List.of(),
                Map.of());
    }

    private static final class TestHarvester implements FederatedSourceHarvester {
        private final List<String> seenCursors = new ArrayList<>();

        @Override
        public FederatedSourceSystem sourceSystem() {
            return FederatedSourceSystem.DATA_GOV;
        }

        @Override
        public HarvestPage fetch(String cursor, int pageSize) {
            seenCursors.add(cursor);
            if (cursor == null) {
                return new HarvestPage(
                        List.of(
                                record(FederatedSourceSystem.DATA_GOV, "001"),
                                record(FederatedSourceSystem.DATA_GOV, "002")),
                        "page-2",
                        false);
            }
            return new HarvestPage(List.of(record(FederatedSourceSystem.DATA_GOV, "003")), null, true);
        }
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
                    .sorted((left, right) -> left.id().compareTo(right.id()))
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

    private static final class InMemoryQuarantineStore implements HarvestQuarantineStore {
        private final List<HarvestQuarantineRecord> records = new ArrayList<>();

        @Override
        public void saveAll(
                String runId,
                FederatedSourceSystem sourceSystem,
                List<HarvestRejection> rejections,
                OffsetDateTime observedAt) {
            for (int index = 0; index < rejections.size(); index++) {
                HarvestRejection rejection = rejections.get(index);
                records.add(new HarvestQuarantineRecord(
                        "quarantine-" + records.size(),
                        runId,
                        sourceSystem,
                        rejection.sourceIdentifier(),
                        rejection.message(),
                        rejection.rawSnippet(),
                        observedAt));
            }
        }

        @Override
        public List<HarvestQuarantineRecord> findRecent(FederatedSourceSystem sourceSystem, int limit) {
            return records.stream()
                    .filter((record) -> record.sourceSystem() == sourceSystem)
                    .limit(limit)
                    .toList();
        }
    }
}
