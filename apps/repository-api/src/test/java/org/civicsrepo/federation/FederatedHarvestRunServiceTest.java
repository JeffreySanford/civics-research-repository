package org.civicsrepo.federation;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.net.URI;
import java.time.Clock;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicInteger;
import org.civicsrepo.generated.dto.ResearchObjectType;
import org.junit.jupiter.api.Test;

class FederatedHarvestRunServiceTest {
    private static final Clock CLOCK = Clock.fixed(Instant.parse("2026-08-29T22:00:00Z"), ZoneOffset.UTC);

    @Test
    void pausesAtInvocationBoundAndResumesSameRunUntilSourceCompletes() {
        InMemoryCatalog catalog = new InMemoryCatalog();
        InMemoryCheckpointStore checkpoints = new InMemoryCheckpointStore();
        InMemoryRunStore runs = new InMemoryRunStore();
        TwoPageHarvester harvester = new TwoPageHarvester("test-v1");
        FederatedHarvestService pageService =
                new FederatedHarvestService(catalog, checkpoints, List.of(harvester));
        FederatedHarvestRunService service =
                new FederatedHarvestRunService(pageService, runs, checkpoints, List.of(harvester), CLOCK);

        HarvestRun first = service.runBounded(FederatedSourceSystem.DATA_GOV, 2, 1);

        assertEquals(HarvestRunStatus.PAUSED, first.status());
        assertEquals(1, first.pageCount());
        assertEquals(2, first.acceptedCount());
        assertEquals("page-2", first.cursor());
        assertNull(first.completedAt());
        assertEquals("test-v1", first.adapterVersion());
        assertEquals(first.id(), runs.findResumable(FederatedSourceSystem.DATA_GOV).orElseThrow().id());

        HarvestRun second = service.runBounded(FederatedSourceSystem.DATA_GOV, 2, 1);

        assertEquals(first.id(), second.id());
        assertEquals(HarvestRunStatus.COMPLETED, second.status());
        assertEquals(2, second.pageCount());
        assertEquals(3, second.acceptedCount());
        assertNull(second.cursor());
        assertEquals(OffsetDateTime.parse("2026-08-29T22:00:00Z"), second.completedAt());
        assertTrue(runs.findResumable(FederatedSourceSystem.DATA_GOV).isEmpty());
        assertEquals(List.of("DATA_GOV:001", "DATA_GOV:002", "DATA_GOV:003"), catalog.records.stream()
                .map(FederatedResearchRecord::id)
                .toList());
    }

    @Test
    void cancelPreservesCheckpointAndLaterRunContinuesWithNewRunId() {
        InMemoryCatalog catalog = new InMemoryCatalog();
        InMemoryCheckpointStore checkpoints = new InMemoryCheckpointStore();
        InMemoryRunStore runs = new InMemoryRunStore();
        TwoPageHarvester harvester = new TwoPageHarvester("test-v1");
        FederatedHarvestService pageService =
                new FederatedHarvestService(catalog, checkpoints, List.of(harvester));
        FederatedHarvestRunService service =
                new FederatedHarvestRunService(pageService, runs, checkpoints, List.of(harvester), CLOCK);

        HarvestRun paused = service.runBounded(FederatedSourceSystem.DATA_GOV, 2, 1);
        HarvestRun cancelled = service.cancel(FederatedSourceSystem.DATA_GOV);

        assertEquals(paused.id(), cancelled.id());
        assertEquals(HarvestRunStatus.CANCELLED, cancelled.status());
        assertEquals(2, cancelled.acceptedCount());
        assertEquals("page-2", cancelled.cursor());
        assertEquals("page-2", checkpoints.find(FederatedSourceSystem.DATA_GOV).orElseThrow().cursor());

        HarvestRun continued = service.runBounded(FederatedSourceSystem.DATA_GOV, 2, 1);

        assertNotEquals(cancelled.id(), continued.id());
        assertEquals(HarvestRunStatus.COMPLETED, continued.status());
        assertEquals(1, continued.pageCount());
        assertEquals(3, continued.acceptedCount());
        assertNull(continued.cursor());
        assertEquals(2, harvester.seenCursors.size());
        assertNull(harvester.seenCursors.getFirst());
        assertEquals("page-2", harvester.seenCursors.get(1));
    }

    @Test
    void restartFromBeginningCancelsExistingRunClearsCheckpointAndStartsNewRunId() {
        InMemoryCatalog catalog = new InMemoryCatalog();
        InMemoryCheckpointStore checkpoints = new InMemoryCheckpointStore();
        InMemoryRunStore runs = new InMemoryRunStore();
        TwoPageHarvester harvester = new TwoPageHarvester("test-v1");
        FederatedHarvestService pageService =
                new FederatedHarvestService(catalog, checkpoints, List.of(harvester));
        FederatedHarvestRunService service =
                new FederatedHarvestRunService(pageService, runs, checkpoints, List.of(harvester), CLOCK);

        HarvestRun first = service.runBounded(FederatedSourceSystem.DATA_GOV, 2, 1);
        HarvestRun restarted = service.restartFromBeginning(FederatedSourceSystem.DATA_GOV, 2, 1);

        assertEquals(HarvestRunStatus.CANCELLED, runs.findById(first.id()).orElseThrow().status());
        assertNotEquals(first.id(), restarted.id());
        assertEquals(HarvestRunStatus.PAUSED, restarted.status());
        assertEquals(2, restarted.acceptedCount());
        assertEquals("page-2", restarted.cursor());
        assertEquals(2, harvester.seenCursors.size());
        assertNull(harvester.seenCursors.getFirst());
        assertNull(harvester.seenCursors.get(1));
        assertEquals("page-2", checkpoints.find(FederatedSourceSystem.DATA_GOV).orElseThrow().cursor());
    }

    @Test
    void recordsQuarantinedCountInDurableRun() {
        InMemoryCatalog catalog = new InMemoryCatalog();
        InMemoryCheckpointStore checkpoints = new InMemoryCheckpointStore();
        InMemoryRunStore runs = new InMemoryRunStore();
        InMemoryQuarantineStore quarantine = new InMemoryQuarantineStore();
        FederatedSourceHarvester harvester = new FederatedSourceHarvester() {
            @Override
            public FederatedSourceSystem sourceSystem() {
                return FederatedSourceSystem.DATA_GOV;
            }

            @Override
            public String adapterVersion() {
                return "test-v1";
            }

            @Override
            public HarvestPage fetch(String cursor, int pageSize) {
                return new HarvestPage(
                        List.of(record("accepted")),
                        List.of(new HarvestRejection("bad", "missing title", "{\"id\":\"bad\"}")),
                        null,
                        true);
            }
        };
        FederatedHarvestService pageService = new FederatedHarvestService(
                catalog,
                checkpoints,
                quarantine,
                List.of(harvester),
                (duration) -> {},
                () -> 1.0);
        FederatedHarvestRunService service =
                new FederatedHarvestRunService(pageService, runs, checkpoints, List.of(harvester), CLOCK);

        HarvestRun run = service.runBounded(FederatedSourceSystem.DATA_GOV, 100, 1);

        assertEquals(HarvestRunStatus.COMPLETED, run.status());
        assertEquals(1, run.acceptedCount());
        assertEquals(1, run.rejectedCount());
        assertEquals(1, quarantine.records.size());
        assertEquals(run.id(), quarantine.records.getFirst().runId());
    }

    @Test
    void recordsFailedRunWithoutAdvancingCheckpoint() {
        InMemoryCatalog catalog = new InMemoryCatalog();
        InMemoryCheckpointStore checkpoints = new InMemoryCheckpointStore();
        checkpoints.save(new HarvestCheckpoint(
                FederatedSourceSystem.DATA_GOV,
                "existing-cursor",
                400,
                OffsetDateTime.parse("2026-08-29T21:00:00Z")));
        InMemoryRunStore runs = new InMemoryRunStore();
        FederatedSourceHarvester invalid = new FederatedSourceHarvester() {
            @Override
            public FederatedSourceSystem sourceSystem() {
                return FederatedSourceSystem.DATA_GOV;
            }

            @Override
            public String adapterVersion() {
                return "test-v1";
            }

            @Override
            public HarvestPage fetch(String cursor, int pageSize) {
                throw FederatedHarvestException.permanent("publisher response failed validation");
            }
        };
        FederatedHarvestService pageService = new FederatedHarvestService(catalog, checkpoints, List.of(invalid));
        FederatedHarvestRunService service =
                new FederatedHarvestRunService(pageService, runs, checkpoints, List.of(invalid), CLOCK);

        FederatedHarvestException failure = assertThrows(
                FederatedHarvestException.class,
                () -> service.runBounded(FederatedSourceSystem.DATA_GOV, 100, 5));

        assertEquals("publisher response failed validation", failure.getMessage());
        HarvestRun failed = runs.findRecent(FederatedSourceSystem.DATA_GOV, 10).getFirst();
        assertEquals(HarvestRunStatus.FAILED, failed.status());
        assertEquals("publisher response failed validation", failed.failureMessage());
        assertEquals(0, failed.pageCount());
        assertEquals(400, failed.acceptedCount());
        assertEquals("existing-cursor", failed.cursor());
        assertEquals("existing-cursor", checkpoints.find(FederatedSourceSystem.DATA_GOV).orElseThrow().cursor());
    }

    @Test
    void refusesToMixAdapterVersionsInsideOneResumableRun() {
        InMemoryCatalog catalog = new InMemoryCatalog();
        InMemoryCheckpointStore checkpoints = new InMemoryCheckpointStore();
        InMemoryRunStore runs = new InMemoryRunStore();
        runs.save(new HarvestRun(
                "run-v1",
                FederatedSourceSystem.DATA_GOV,
                "test-v1",
                HarvestRunStatus.PAUSED,
                100,
                3,
                300,
                0,
                0,
                "page-4",
                OffsetDateTime.parse("2026-08-29T20:00:00Z"),
                OffsetDateTime.parse("2026-08-29T20:05:00Z"),
                null,
                null));
        AtomicInteger fetches = new AtomicInteger();
        FederatedSourceHarvester v2 = new FederatedSourceHarvester() {
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
                fetches.incrementAndGet();
                return new HarvestPage(List.of(), null, true);
            }
        };
        FederatedHarvestService pageService = new FederatedHarvestService(catalog, checkpoints, List.of(v2));
        FederatedHarvestRunService service =
                new FederatedHarvestRunService(pageService, runs, checkpoints, List.of(v2), CLOCK);

        IllegalStateException failure = assertThrows(
                IllegalStateException.class,
                () -> service.runBounded(FederatedSourceSystem.DATA_GOV, 100, 1));

        assertTrue(failure.getMessage().contains("cannot resume with test-v2"));
        assertEquals(0, fetches.get());
        assertEquals(HarvestRunStatus.PAUSED, runs.findById("run-v1").orElseThrow().status());
    }

    @Test
    void refusesToChangePageSizeInsideOneResumableRun() {
        InMemoryCatalog catalog = new InMemoryCatalog();
        InMemoryCheckpointStore checkpoints = new InMemoryCheckpointStore();
        InMemoryRunStore runs = new InMemoryRunStore();
        TwoPageHarvester harvester = new TwoPageHarvester("test-v1");
        FederatedHarvestService pageService =
                new FederatedHarvestService(catalog, checkpoints, List.of(harvester));
        FederatedHarvestRunService service =
                new FederatedHarvestRunService(pageService, runs, checkpoints, List.of(harvester), CLOCK);

        HarvestRun paused = service.runBounded(FederatedSourceSystem.DATA_GOV, 2, 1);
        IllegalStateException failure = assertThrows(
                IllegalStateException.class,
                () -> service.runBounded(FederatedSourceSystem.DATA_GOV, 3, 1));

        assertTrue(failure.getMessage().contains("pageSize 2"));
        assertEquals(paused.id(), runs.findResumable(FederatedSourceSystem.DATA_GOV).orElseThrow().id());
    }

    @Test
    void cancelRequiresResumableRun() {
        InMemoryCatalog catalog = new InMemoryCatalog();
        InMemoryCheckpointStore checkpoints = new InMemoryCheckpointStore();
        InMemoryRunStore runs = new InMemoryRunStore();
        TwoPageHarvester harvester = new TwoPageHarvester("test-v1");
        FederatedHarvestService pageService =
                new FederatedHarvestService(catalog, checkpoints, List.of(harvester));
        FederatedHarvestRunService service =
                new FederatedHarvestRunService(pageService, runs, checkpoints, List.of(harvester), CLOCK);

        IllegalStateException failure = assertThrows(
                IllegalStateException.class,
                () -> service.cancel(FederatedSourceSystem.DATA_GOV));

        assertTrue(failure.getMessage().contains("No resumable harvest run"));
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
                OffsetDateTime.parse("2026-08-29T12:00:00Z"),
                "test-v1",
                List.of(),
                List.of(),
                Map.of());
    }

    private static final class TwoPageHarvester implements FederatedSourceHarvester {
        private final String version;
        private final List<String> seenCursors = new ArrayList<>();

        private TwoPageHarvester(String version) {
            this.version = version;
        }

        @Override
        public FederatedSourceSystem sourceSystem() {
            return FederatedSourceSystem.DATA_GOV;
        }

        @Override
        public String adapterVersion() {
            return version;
        }

        @Override
        public HarvestPage fetch(String cursor, int pageSize) {
            seenCursors.add(cursor);
            if (cursor == null) {
                return new HarvestPage(List.of(record("001"), record("002")), "page-2", false);
            }
            return new HarvestPage(List.of(record("003")), null, true);
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
                    .sorted((left, right) -> right.startedAt().compareTo(left.startedAt()))
                    .limit(limit)
                    .toList();
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
            for (HarvestRejection rejection : rejections) {
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
