package org.civicsrepo.federation;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.URI;
import java.time.Clock;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.EnumMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.civicsrepo.generated.dto.ResearchObjectType;
import org.junit.jupiter.api.Test;

class FederatedHarvestCompletionManifestTest {
    private static final Clock CLOCK = Clock.fixed(Instant.parse("2026-08-30T15:00:00Z"), ZoneOffset.UTC);

    @Test
    void completedHarvestAutomaticallyCapturesTheRetainedSourceManifest() {
        InMemoryCatalog catalog = new InMemoryCatalog();
        InMemoryCheckpointStore checkpoints = new InMemoryCheckpointStore();
        InMemoryRunStore runs = new InMemoryRunStore();
        InMemoryManifestStore manifests = new InMemoryManifestStore();
        SinglePageHarvester harvester = new SinglePageHarvester();
        FederatedHarvestService pageService =
                new FederatedHarvestService(catalog, checkpoints, List.of(harvester));
        FederatedCorpusManifestService generator =
                new FederatedCorpusManifestService(catalog, runs, new ObjectMapper(), 1);
        FederatedCorpusManifestCaptureService capture =
                new FederatedCorpusManifestCaptureService(generator, manifests);
        FederatedHarvestRunService service = new FederatedHarvestRunService(
                pageService,
                runs,
                checkpoints,
                List.of(harvester),
                List.of(capture),
                CLOCK);

        HarvestRun completed = service.runBounded(FederatedSourceSystem.DATA_GOV, 100, 1);

        assertThat(completed.status()).isEqualTo(HarvestRunStatus.COMPLETED);
        FederatedCorpusManifest manifest = manifests.findByRunId(completed.id()).orElseThrow();
        assertThat(manifest.runId()).isEqualTo(completed.id());
        assertThat(manifest.sourceSystem()).isEqualTo(FederatedSourceSystem.DATA_GOV);
        assertThat(manifest.retainedRecordCount()).isEqualTo(2);
        assertThat(manifest.acceptedCount()).isEqualTo(2);
        assertThat(manifest.firstRecordId()).isEqualTo("DATA_GOV:alpha");
        assertThat(manifest.lastRecordId()).isEqualTo("DATA_GOV:bravo");
        assertThat(manifest.sha256()).hasSize(64);
    }

    @Test
    void completionEvidenceFailureDoesNotRewriteSuccessfulHarvestAsFailed() {
        InMemoryCatalog catalog = new InMemoryCatalog();
        InMemoryCheckpointStore checkpoints = new InMemoryCheckpointStore();
        InMemoryRunStore runs = new InMemoryRunStore();
        SinglePageHarvester harvester = new SinglePageHarvester();
        FederatedHarvestService pageService =
                new FederatedHarvestService(catalog, checkpoints, List.of(harvester));
        FederatedHarvestCompletionListener failingListener = run -> {
            throw new IllegalStateException("evidence store unavailable");
        };
        FederatedHarvestRunService service = new FederatedHarvestRunService(
                pageService,
                runs,
                checkpoints,
                List.of(harvester),
                List.of(failingListener),
                CLOCK);

        assertThatThrownBy(() -> service.runBounded(FederatedSourceSystem.DATA_GOV, 100, 1))
                .isInstanceOf(IllegalStateException.class)
                .hasMessage("evidence store unavailable");

        HarvestRun durableRun = runs.findRecent(FederatedSourceSystem.DATA_GOV, 1).getFirst();
        assertThat(durableRun.status()).isEqualTo(HarvestRunStatus.COMPLETED);
        assertThat(durableRun.failureMessage()).isNull();
        assertThat(durableRun.acceptedCount()).isEqualTo(2);
    }

    private static final class SinglePageHarvester implements FederatedSourceHarvester {
        @Override
        public FederatedSourceSystem sourceSystem() {
            return FederatedSourceSystem.DATA_GOV;
        }

        @Override
        public String adapterVersion() {
            return "data-gov-test-v1";
        }

        @Override
        public HarvestPage fetch(String cursor, int pageSize) {
            return new HarvestPage(List.of(record("alpha"), record("bravo")), null, true);
        }
    }

    private static FederatedResearchRecord record(String sourceIdentifier) {
        return new FederatedResearchRecord(
                FederatedSourceSystem.DATA_GOV,
                sourceIdentifier,
                "Title " + sourceIdentifier,
                "Summary " + sourceIdentifier,
                "U.S. Department of Energy",
                "Office of Science",
                ResearchObjectType.DATASET,
                URI.create("https://example.test/" + sourceIdentifier),
                OffsetDateTime.parse("2026-08-29T10:00:00Z"),
                OffsetDateTime.parse("2026-08-30T14:59:00Z"),
                "data-gov-test-v1",
                List.of("Ada Lovelace"),
                List.of("science"),
                Map.of("agency", "DOE"));
    }

    private static final class InMemoryCatalog implements FederatedMetadataCatalog {
        private final Map<String, FederatedResearchRecord> records = new LinkedHashMap<>();

        @Override
        public void upsertBatch(List<FederatedResearchRecord> records) {
            records.forEach((record) -> this.records.put(record.id(), record));
        }

        @Override
        public Optional<FederatedResearchRecord> findById(String id) {
            return Optional.ofNullable(records.get(id));
        }

        @Override
        public List<FederatedResearchRecord> findAfterId(String afterId, int limit) {
            return records.values().stream()
                    .sorted(Comparator.comparing(FederatedResearchRecord::id))
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
                    .max(Comparator.comparing(HarvestRun::updatedAt));
        }

        @Override
        public List<HarvestRun> findRecent(FederatedSourceSystem sourceSystem, int limit) {
            return runs.values().stream()
                    .filter((run) -> run.sourceSystem() == sourceSystem)
                    .sorted(Comparator.comparing(HarvestRun::startedAt).reversed())
                    .limit(limit)
                    .toList();
        }
    }

    private static final class InMemoryManifestStore implements FederatedCorpusManifestStore {
        private final Map<String, FederatedCorpusManifest> manifests = new LinkedHashMap<>();

        @Override
        public void save(FederatedCorpusManifest manifest) {
            manifests.put(manifest.runId(), manifest);
        }

        @Override
        public Optional<FederatedCorpusManifest> findByRunId(String runId) {
            return Optional.ofNullable(manifests.get(runId));
        }

        @Override
        public List<FederatedCorpusManifest> findRecent(FederatedSourceSystem sourceSystem, int limit) {
            return new ArrayList<>(manifests.values()).stream()
                    .filter((manifest) -> manifest.sourceSystem() == sourceSystem)
                    .sorted(Comparator.comparing(FederatedCorpusManifest::runCompletedAt).reversed())
                    .limit(limit)
                    .toList();
        }
    }
}
