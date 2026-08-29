package org.civicsrepo.federation;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.net.URI;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
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
}
