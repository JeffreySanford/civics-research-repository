package org.civicsrepo.federation;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.URI;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.civicsrepo.generated.dto.ResearchObjectType;
import org.junit.jupiter.api.Test;

class FederatedCorpusProfileBoundedSnapshotTest {
    private static final OffsetDateTime STARTED_AT = OffsetDateTime.parse("2026-08-30T12:00:00Z");
    private static final OffsetDateTime UPDATED_AT = OffsetDateTime.parse("2026-08-30T12:10:00Z");
    private static final OffsetDateTime CAPTURED_AT = OffsetDateTime.parse("2026-08-30T12:11:00Z");

    @Test
    void hashesExactlyTheRequestedStablePrefixWhenMoreSourceRecordsAreRetained() {
        HarvestRun run = new HarvestRun(
                "run-over-target",
                FederatedSourceSystem.DATA_GOV,
                "data-gov-v1",
                HarvestRunStatus.PAUSED,
                100,
                1_001,
                100_037,
                0,
                0,
                "100100",
                STARTED_AT,
                UPDATED_AT,
                null,
                null);
        List<FederatedResearchRecord> all = List.of(record("alpha"), record("bravo"), record("charlie"));

        FederatedCorpusManifestService service = new FederatedCorpusManifestService(
                new ListCatalog(all), new SingleRunStore(run), new ObjectMapper(), 2);
        FederatedBoundedSnapshotManifest bounded =
                service.generateBoundedSnapshot(run.id(), 2, CAPTURED_AT);

        FederatedCorpusManifestService exactPrefixService = new FederatedCorpusManifestService(
                new ListCatalog(all.subList(0, 2)), new SingleRunStore(run), new ObjectMapper(), 2);
        FederatedBoundedSnapshotManifest exactPrefix =
                exactPrefixService.generateBoundedSnapshot(run.id(), CAPTURED_AT);

        assertThat(bounded.retainedRecordCount()).isEqualTo(2);
        assertThat(bounded.firstRecordId()).isEqualTo("DATA_GOV:alpha");
        assertThat(bounded.lastRecordId()).isEqualTo("DATA_GOV:bravo");
        assertThat(bounded.sha256()).isEqualTo(exactPrefix.sha256());
        assertThat(bounded.snapshotId()).isEqualTo(exactPrefix.snapshotId());
        assertThat(bounded.acceptedCount()).isEqualTo(100_037);
    }

    private FederatedResearchRecord record(String sourceIdentifier) {
        return new FederatedResearchRecord(
                FederatedSourceSystem.DATA_GOV,
                sourceIdentifier,
                "Title " + sourceIdentifier,
                "Summary " + sourceIdentifier,
                "Publisher",
                "Program",
                ResearchObjectType.DATASET,
                URI.create("https://example.test/" + sourceIdentifier),
                OffsetDateTime.parse("2026-08-29T10:00:00Z"),
                OffsetDateTime.parse("2026-08-30T11:00:00Z"),
                "data-gov-v1",
                List.of(),
                List.of(),
                Map.of());
    }

    private static final class ListCatalog implements FederatedMetadataCatalog {
        private final List<FederatedResearchRecord> records;

        private ListCatalog(List<FederatedResearchRecord> records) {
            this.records = records.stream()
                    .sorted(Comparator.comparing(FederatedResearchRecord::id))
                    .toList();
        }

        @Override
        public void upsertBatch(List<FederatedResearchRecord> records) {
            throw new UnsupportedOperationException();
        }

        @Override
        public Optional<FederatedResearchRecord> findById(String id) {
            return records.stream().filter((record) -> record.id().equals(id)).findFirst();
        }

        @Override
        public List<FederatedResearchRecord> findAfterId(String afterId, int limit) {
            List<FederatedResearchRecord> page = new ArrayList<>();
            for (FederatedResearchRecord record : records) {
                if ((afterId == null || record.id().compareTo(afterId) > 0) && page.size() < limit) {
                    page.add(record);
                }
            }
            return List.copyOf(page);
        }

        @Override
        public long count() {
            return records.size();
        }
    }

    private record SingleRunStore(HarvestRun run) implements HarvestRunStore {
        @Override
        public void save(HarvestRun run) {
            throw new UnsupportedOperationException();
        }

        @Override
        public Optional<HarvestRun> findById(String id) {
            return run.id().equals(id) ? Optional.of(run) : Optional.empty();
        }

        @Override
        public Optional<HarvestRun> findResumable(FederatedSourceSystem sourceSystem) {
            return Optional.empty();
        }

        @Override
        public List<HarvestRun> findRecent(FederatedSourceSystem sourceSystem, int limit) {
            return List.of(run);
        }
    }
}
