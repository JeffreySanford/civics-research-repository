package org.civicsrepo.federation;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.URI;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.civicsrepo.generated.dto.ResearchObjectType;
import org.junit.jupiter.api.Test;

class FederatedCorpusManifestServiceTest {
    private static final OffsetDateTime STARTED_AT = OffsetDateTime.parse("2026-08-30T12:00:00Z");
    private static final OffsetDateTime COMPLETED_AT = OffsetDateTime.parse("2026-08-30T12:05:00Z");

    @Test
    void generatesTheSameCorpusIdentityAcrossPageBoundariesAndOperationalHarvestTimes() {
        HarvestRun run = completedRun("run-1", FederatedSourceSystem.DATA_GOV);
        List<FederatedResearchRecord> firstSnapshot = List.of(
                record(
                        FederatedSourceSystem.DATA_GOV,
                        "alpha",
                        OffsetDateTime.parse("2026-08-29T10:00:00Z"),
                        OffsetDateTime.parse("2026-08-30T11:00:00Z"),
                        orderedMetadata("agency", "DOE", "theme", "energy")),
                record(
                        FederatedSourceSystem.DATA_GOV,
                        "bravo",
                        OffsetDateTime.parse("2026-08-29T11:00:00Z"),
                        OffsetDateTime.parse("2026-08-30T11:01:00Z"),
                        orderedMetadata("theme", "science", "agency", "DOE")));
        List<FederatedResearchRecord> equivalentSnapshot = List.of(
                record(
                        FederatedSourceSystem.DATA_GOV,
                        "alpha",
                        OffsetDateTime.parse("2026-08-29T10:00:00Z"),
                        OffsetDateTime.parse("2026-08-31T01:00:00Z"),
                        orderedMetadata("theme", "energy", "agency", "DOE")),
                record(
                        FederatedSourceSystem.DATA_GOV,
                        "bravo",
                        OffsetDateTime.parse("2026-08-29T11:00:00Z"),
                        OffsetDateTime.parse("2026-08-31T01:01:00Z"),
                        orderedMetadata("agency", "DOE", "theme", "science")));

        FederatedCorpusManifest oneAtATime = new FederatedCorpusManifestService(
                        new ListCatalog(firstSnapshot), new SingleRunStore(run), new ObjectMapper(), 1)
                .generate(run.id());
        FederatedCorpusManifest twoAtATime = new FederatedCorpusManifestService(
                        new ListCatalog(equivalentSnapshot), new SingleRunStore(run), new ObjectMapper(), 2)
                .generate(run.id());

        assertThat(oneAtATime.sha256()).isEqualTo(twoAtATime.sha256());
        assertThat(oneAtATime.retainedRecordCount()).isEqualTo(2);
        assertThat(oneAtATime.firstRecordId()).isEqualTo("DATA_GOV:alpha");
        assertThat(oneAtATime.lastRecordId()).isEqualTo("DATA_GOV:bravo");
        assertThat(oneAtATime.recordAdapterVersions()).containsExactly("data-gov-v1");
        assertThat(oneAtATime.earliestSourceUpdatedAt())
                .isEqualTo(OffsetDateTime.parse("2026-08-29T10:00:00Z"));
        assertThat(oneAtATime.latestSourceUpdatedAt())
                .isEqualTo(OffsetDateTime.parse("2026-08-29T11:00:00Z"));
        assertThat(oneAtATime.acceptedCount()).isEqualTo(2);
        assertThat(oneAtATime.rejectedCount()).isEqualTo(1);
        assertThat(oneAtATime.skippedCount()).isZero();
    }

    @Test
    void isolatesTheCompletedRunsSourceFromOtherRetainedFederatedRecords() {
        HarvestRun run = completedRun("run-data-gov", FederatedSourceSystem.DATA_GOV);
        List<FederatedResearchRecord> records = List.of(
                record(
                        FederatedSourceSystem.DATA_GOV,
                        "alpha",
                        OffsetDateTime.parse("2026-08-29T10:00:00Z"),
                        OffsetDateTime.parse("2026-08-30T11:00:00Z"),
                        Map.of()),
                record(
                        FederatedSourceSystem.DOE_OSTI,
                        "osti-1",
                        OffsetDateTime.parse("2026-08-29T12:00:00Z"),
                        OffsetDateTime.parse("2026-08-30T11:02:00Z"),
                        Map.of()));

        FederatedCorpusManifest manifest = new FederatedCorpusManifestService(
                        new ListCatalog(records), new SingleRunStore(run), new ObjectMapper(), 10)
                .generate(run.id());

        assertThat(manifest.sourceSystem()).isEqualTo(FederatedSourceSystem.DATA_GOV);
        assertThat(manifest.retainedRecordCount()).isEqualTo(1);
        assertThat(manifest.firstRecordId()).isEqualTo("DATA_GOV:alpha");
        assertThat(manifest.lastRecordId()).isEqualTo("DATA_GOV:alpha");
        assertThat(manifest.recordAdapterVersions()).containsExactly("data-gov-v1");
    }

    @Test
    void refusesToManifestANonCompletedRun() {
        HarvestRun paused = new HarvestRun(
                "run-paused",
                FederatedSourceSystem.DATA_GOV,
                "data-gov-v1",
                HarvestRunStatus.PAUSED,
                100,
                1,
                100,
                0,
                0,
                "100",
                STARTED_AT,
                STARTED_AT.plusMinutes(1),
                null,
                null);
        FederatedCorpusManifestService service = new FederatedCorpusManifestService(
                new ListCatalog(List.of()), new SingleRunStore(paused), new ObjectMapper(), 10);

        assertThatThrownBy(() -> service.generate(paused.id()))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("COMPLETED");
    }

    @Test
    void capturesAPausedRunAsABoundedSnapshotWithoutClaimingSourceCompletion() {
        HarvestRun paused = new HarvestRun(
                "run-paused-1k",
                FederatedSourceSystem.DATA_GOV,
                "data-gov-v1",
                HarvestRunStatus.PAUSED,
                100,
                10,
                1_000,
                3,
                0,
                "opaque-after-token",
                STARTED_AT,
                STARTED_AT.plusMinutes(4),
                null,
                null);
        List<FederatedResearchRecord> records = List.of(
                record(
                        FederatedSourceSystem.DATA_GOV,
                        "alpha",
                        OffsetDateTime.parse("2026-08-29T10:00:00Z"),
                        OffsetDateTime.parse("2026-08-30T11:00:00Z"),
                        Map.of()),
                record(
                        FederatedSourceSystem.DATA_GOV,
                        "bravo",
                        OffsetDateTime.parse("2026-08-29T11:00:00Z"),
                        OffsetDateTime.parse("2026-08-30T11:01:00Z"),
                        Map.of()));
        FederatedCorpusManifestService service = new FederatedCorpusManifestService(
                new ListCatalog(records), new SingleRunStore(paused), new ObjectMapper(), 1);
        OffsetDateTime capturedAt = OffsetDateTime.parse("2026-08-30T12:04:30Z");

        FederatedBoundedSnapshotManifest snapshot = service.generateBoundedSnapshot(paused.id(), capturedAt);

        assertThat(snapshot.manifestVersion()).isEqualTo("federated-bounded-snapshot/v1");
        assertThat(snapshot.mode()).isEqualTo("BOUNDED_SNAPSHOT");
        assertThat(snapshot.runStatus()).isEqualTo(HarvestRunStatus.PAUSED);
        assertThat(snapshot.retainedRecordCount()).isEqualTo(2);
        assertThat(snapshot.acceptedCount()).isEqualTo(1_000);
        assertThat(snapshot.rejectedCount()).isEqualTo(3);
        assertThat(snapshot.pageSize()).isEqualTo(100);
        assertThat(snapshot.pageCount()).isEqualTo(10);
        assertThat(snapshot.cursor()).isEqualTo("opaque-after-token");
        assertThat(snapshot.capturedAt()).isEqualTo(capturedAt);
        assertThat(snapshot.snapshotId()).isEqualTo("DATA_GOV:" + snapshot.sha256());
        assertThat(snapshot.firstRecordId()).isEqualTo("DATA_GOV:alpha");
        assertThat(snapshot.lastRecordId()).isEqualTo("DATA_GOV:bravo");
    }

    @Test
    void boundedSnapshotAndCompletedManifestUseTheSameRetainedContentDigest() {
        HarvestRun completed = completedRun("run-completed", FederatedSourceSystem.DATA_GOV);
        List<FederatedResearchRecord> records = List.of(record(
                FederatedSourceSystem.DATA_GOV,
                "alpha",
                OffsetDateTime.parse("2026-08-29T10:00:00Z"),
                OffsetDateTime.parse("2026-08-30T11:00:00Z"),
                Map.of()));
        FederatedCorpusManifestService service = new FederatedCorpusManifestService(
                new ListCatalog(records), new SingleRunStore(completed), new ObjectMapper(), 10);

        FederatedCorpusManifest completedManifest = service.generate(completed.id());
        FederatedBoundedSnapshotManifest boundedSnapshot =
                service.generateBoundedSnapshot(completed.id(), COMPLETED_AT);

        assertThat(boundedSnapshot.sha256()).isEqualTo(completedManifest.sha256());
        assertThat(boundedSnapshot.runStatus()).isEqualTo(HarvestRunStatus.COMPLETED);
    }

    private HarvestRun completedRun(String id, FederatedSourceSystem sourceSystem) {
        return new HarvestRun(
                id,
                sourceSystem,
                sourceSystem == FederatedSourceSystem.DATA_GOV ? "data-gov-v1" : "adapter-v1",
                HarvestRunStatus.COMPLETED,
                100,
                2,
                2,
                1,
                0,
                null,
                STARTED_AT,
                COMPLETED_AT,
                COMPLETED_AT,
                null);
    }

    private FederatedResearchRecord record(
            FederatedSourceSystem sourceSystem,
            String sourceIdentifier,
            OffsetDateTime sourceUpdatedAt,
            OffsetDateTime harvestedAt,
            Map<String, Object> sourceMetadata) {
        return new FederatedResearchRecord(
                sourceSystem,
                sourceIdentifier,
                "Title " + sourceIdentifier,
                "Summary " + sourceIdentifier,
                "U.S. Department of Energy",
                "Office of Science",
                ResearchObjectType.DATASET,
                URI.create("https://example.test/" + sourceIdentifier),
                sourceUpdatedAt,
                harvestedAt,
                sourceSystem == FederatedSourceSystem.DATA_GOV ? "data-gov-v1" : "osti-v1",
                List.of("Ada Lovelace"),
                List.of("energy", "science"),
                sourceMetadata);
    }

    private Map<String, Object> orderedMetadata(String firstKey, String firstValue, String secondKey, String secondValue) {
        Map<String, Object> metadata = new LinkedHashMap<>();
        metadata.put(firstKey, firstValue);
        metadata.put(secondKey, secondValue);
        return metadata;
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
            return run.sourceSystem() == sourceSystem ? List.of(run) : List.of();
        }
    }
}
