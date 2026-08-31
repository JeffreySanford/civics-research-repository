package org.civicsrepo.federation;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.Test;

class FederatedCompositeCorpusManifestServiceTest {
    private static final OffsetDateTime CAPTURED_AT = OffsetDateTime.parse("2026-08-31T18:30:00Z");
    private static final String FEDERATED_1M_GOLDEN_SHA256 =
            "342157e25da83ee890efb1b05837117cdb62c1fad2f39a02e09161c6c1cdb83b";

    @Test
    void reproducesCompositionIdentityAcrossSourceOrderRunIdsAndCaptureTimes() {
        FederatedBoundedSnapshotManifest dataGovFirst = snapshot(
                FederatedSourceSystem.DATA_GOV,
                "data-run-1",
                "data-gov-catalog-v4-v2",
                "a".repeat(64),
                "2026-08-31T18:00:00Z");
        FederatedBoundedSnapshotManifest ostiFirst = snapshot(
                FederatedSourceSystem.DOE_OSTI,
                "osti-run-1",
                "osti-records-v1",
                "b".repeat(64),
                "2026-08-31T18:01:00Z");
        FederatedBoundedSnapshotManifest dataGovRecaptured = snapshot(
                FederatedSourceSystem.DATA_GOV,
                "data-run-2",
                "data-gov-catalog-v4-v2",
                "a".repeat(64),
                "2026-09-01T01:00:00Z");
        FederatedBoundedSnapshotManifest ostiRecaptured = snapshot(
                FederatedSourceSystem.DOE_OSTI,
                "osti-run-2",
                "osti-records-v1",
                "b".repeat(64),
                "2026-09-01T01:01:00Z");

        CollectingCompositeStore firstStore = new CollectingCompositeStore();
        FederatedCompositeCorpusManifest first = new FederatedCompositeCorpusManifestService(
                        new InMemorySnapshotStore(List.of(dataGovFirst, ostiFirst)), firstStore, new ObjectMapper())
                .capture(
                        CorpusProfile.FEDERATED_1M,
                        List.of(request(ostiFirst), request(dataGovFirst)),
                        CAPTURED_AT);

        CollectingCompositeStore secondStore = new CollectingCompositeStore();
        FederatedCompositeCorpusManifest second = new FederatedCompositeCorpusManifestService(
                        new InMemorySnapshotStore(List.of(dataGovRecaptured, ostiRecaptured)),
                        secondStore,
                        new ObjectMapper())
                .capture(
                        CorpusProfile.FEDERATED_1M,
                        List.of(request(dataGovRecaptured), request(ostiRecaptured)),
                        CAPTURED_AT.plusHours(8));

        assertThat(first.compositionSha256()).isEqualTo(FEDERATED_1M_GOLDEN_SHA256);
        assertThat(first.compositionSha256()).isEqualTo(second.compositionSha256());
        assertThat(first.sources())
                .extracting(FederatedCompositeCorpusSource::sourceSystem)
                .containsExactly(FederatedSourceSystem.DATA_GOV, FederatedSourceSystem.DOE_OSTI);
        assertThat(first.federatedRecordCount()).isEqualTo(1_000_000);
        assertThat(firstStore.saved).containsExactly(first);
        assertThat(secondStore.saved).containsExactly(second);
        assertThat(first.sources().get(0).runId()).isNotEqualTo(second.sources().get(0).runId());
    }

    @Test
    void refusesACompositionWhoseExactSourceQuotasDoNotReachTheProfileTarget() {
        FederatedBoundedSnapshotManifest dataGov = snapshot(
                FederatedSourceSystem.DATA_GOV,
                "data-run",
                "data-gov-catalog-v4-v2",
                "a".repeat(64),
                "2026-08-31T18:00:00Z",
                400_000);
        FederatedBoundedSnapshotManifest osti = snapshot(
                FederatedSourceSystem.DOE_OSTI,
                "osti-run",
                "osti-records-v1",
                "b".repeat(64),
                "2026-08-31T18:01:00Z",
                500_000);
        FederatedCompositeCorpusManifestService service = new FederatedCompositeCorpusManifestService(
                new InMemorySnapshotStore(List.of(dataGov, osti)), new CollectingCompositeStore(), new ObjectMapper());

        assertThatThrownBy(() -> service.capture(
                        CorpusProfile.FEDERATED_1M,
                        List.of(request(dataGov), request(osti)),
                        CAPTURED_AT))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("900000")
                .hasMessageContaining("1000000");
    }

    @Test
    void refusesDuplicateSourcesOrAQuotaThatDoesNotMatchTheSelectedSnapshot() {
        FederatedBoundedSnapshotManifest dataGov = snapshot(
                FederatedSourceSystem.DATA_GOV,
                "data-run",
                "data-gov-catalog-v4-v2",
                "a".repeat(64),
                "2026-08-31T18:00:00Z");
        FederatedBoundedSnapshotManifest osti = snapshot(
                FederatedSourceSystem.DOE_OSTI,
                "osti-run",
                "osti-records-v1",
                "b".repeat(64),
                "2026-08-31T18:01:00Z");
        FederatedCompositeCorpusManifestService service = new FederatedCompositeCorpusManifestService(
                new InMemorySnapshotStore(List.of(dataGov, osti)), new CollectingCompositeStore(), new ObjectMapper());

        assertThatThrownBy(() -> service.capture(
                        CorpusProfile.FEDERATED_1M,
                        List.of(request(dataGov), request(dataGov)),
                        CAPTURED_AT))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Duplicate composite source");

        FederatedCompositeCorpusSourceRequest wrongQuota = new FederatedCompositeCorpusSourceRequest(
                FederatedSourceSystem.DATA_GOV, 499_999, dataGov.snapshotId());
        assertThatThrownBy(() -> service.capture(
                        CorpusProfile.FEDERATED_1M,
                        List.of(wrongQuota, request(osti)),
                        CAPTURED_AT))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("retains 500000")
                .hasMessageContaining("requests 499999");
    }

    private FederatedCompositeCorpusSourceRequest request(FederatedBoundedSnapshotManifest snapshot) {
        return new FederatedCompositeCorpusSourceRequest(
                snapshot.sourceSystem(), snapshot.retainedRecordCount(), snapshot.snapshotId());
    }

    private FederatedBoundedSnapshotManifest snapshot(
            FederatedSourceSystem sourceSystem,
            String runId,
            String adapterVersion,
            String sha256,
            String capturedAt) {
        return snapshot(sourceSystem, runId, adapterVersion, sha256, capturedAt, 500_000);
    }

    private FederatedBoundedSnapshotManifest snapshot(
            FederatedSourceSystem sourceSystem,
            String runId,
            String adapterVersion,
            String sha256,
            String capturedAt,
            long retainedRecordCount) {
        return new FederatedBoundedSnapshotManifest(
                FederatedCorpusManifestService.BOUNDED_SNAPSHOT_VERSION,
                FederatedBoundedSnapshotManifest.MODE,
                sourceSystem.name() + ":" + sha256,
                runId,
                sourceSystem,
                adapterVersion,
                List.of(adapterVersion),
                HarvestRunStatus.PAUSED,
                retainedRecordCount,
                retainedRecordCount,
                0,
                0,
                sourceSystem.name() + ":alpha",
                sourceSystem.name() + ":zulu",
                sha256,
                OffsetDateTime.parse("2026-08-01T00:00:00Z"),
                OffsetDateTime.parse("2026-08-30T23:59:59Z"),
                100,
                Math.toIntExact(retainedRecordCount / 100),
                "cursor-" + sourceSystem.name(),
                OffsetDateTime.parse("2026-08-31T17:00:00Z"),
                OffsetDateTime.parse("2026-08-31T17:59:00Z"),
                OffsetDateTime.parse(capturedAt));
    }

    private static final class InMemorySnapshotStore implements FederatedBoundedSnapshotManifestStore {
        private final Map<String, FederatedBoundedSnapshotManifest> snapshots = new HashMap<>();

        private InMemorySnapshotStore(List<FederatedBoundedSnapshotManifest> snapshots) {
            for (FederatedBoundedSnapshotManifest snapshot : snapshots) {
                this.snapshots.put(snapshot.snapshotId(), snapshot);
            }
        }

        @Override
        public void save(FederatedBoundedSnapshotManifest manifest) {
            snapshots.put(manifest.snapshotId(), manifest);
        }

        @Override
        public Optional<FederatedBoundedSnapshotManifest> findBySnapshotId(String snapshotId) {
            return Optional.ofNullable(snapshots.get(snapshotId));
        }

        @Override
        public List<FederatedBoundedSnapshotManifest> findRecent(FederatedSourceSystem sourceSystem, int limit) {
            return snapshots.values().stream()
                    .filter(snapshot -> snapshot.sourceSystem() == sourceSystem)
                    .limit(limit)
                    .toList();
        }
    }

    private static final class CollectingCompositeStore implements FederatedCompositeCorpusManifestStore {
        private final List<FederatedCompositeCorpusManifest> saved = new ArrayList<>();

        @Override
        public void save(FederatedCompositeCorpusManifest manifest) {
            saved.add(manifest);
        }

        @Override
        public Optional<FederatedCompositeCorpusManifest> findByCompositionSha256(String compositionSha256) {
            return saved.stream()
                    .filter(manifest -> manifest.compositionSha256().equals(compositionSha256))
                    .findFirst();
        }

        @Override
        public List<FederatedCompositeCorpusManifest> findRecent(CorpusProfile corpusProfile, int limit) {
            return saved.stream()
                    .filter(manifest -> manifest.corpusProfile() == corpusProfile)
                    .limit(limit)
                    .toList();
        }
    }
}
