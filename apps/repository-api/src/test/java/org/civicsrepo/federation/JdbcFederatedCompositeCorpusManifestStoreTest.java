package org.civicsrepo.federation;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.OffsetDateTime;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.jdbc.datasource.DriverManagerDataSource;

class JdbcFederatedCompositeCorpusManifestStoreTest {
    private JdbcFederatedCompositeCorpusManifestStore store;

    @BeforeEach
    void setUp() {
        DriverManagerDataSource dataSource = new DriverManagerDataSource(
                "jdbc:h2:mem:composite-corpus-" + System.nanoTime() + ";MODE=PostgreSQL;DB_CLOSE_DELAY=-1",
                "sa",
                "");
        store = new JdbcFederatedCompositeCorpusManifestStore(JdbcClient.create(dataSource));
        store.createSchema();
    }

    @Test
    void savesAndReloadsEveryCompositeManifestField() {
        FederatedCompositeCorpusManifest manifest = manifest(
                "c".repeat(64), "2026-08-31T18:30:00Z", "data-run-1", "osti-run-1");

        store.save(manifest);

        assertThat(store.findByCompositionSha256(manifest.compositionSha256())).contains(manifest);
    }

    @Test
    void preservesTheFirstImmutableEvidenceCaptureForTheSameCompositionIdentity() {
        FederatedCompositeCorpusManifest original = manifest(
                "c".repeat(64), "2026-08-31T18:30:00Z", "data-run-1", "osti-run-1");
        FederatedCompositeCorpusManifest recaptured = manifest(
                "c".repeat(64), "2026-09-01T01:30:00Z", "data-run-2", "osti-run-2");

        store.save(original);
        store.save(recaptured);

        assertThat(store.findByCompositionSha256(original.compositionSha256())).contains(original);
        assertThat(store.findRecent(CorpusProfile.FEDERATED_1M, 10)).containsExactly(original);
    }

    @Test
    void refusesToReuseACompositionDigestForDifferentSourceIdentity() {
        FederatedCompositeCorpusManifest original = manifest(
                "c".repeat(64), "2026-08-31T18:30:00Z", "data-run-1", "osti-run-1");
        FederatedCompositeCorpusManifest conflicting = new FederatedCompositeCorpusManifest(
                original.compositionVersion(),
                original.mode(),
                original.corpusProfile(),
                List.of(
                        source(
                                FederatedSourceSystem.DATA_GOV,
                                "d".repeat(64),
                                "data-run-conflict",
                                "data-gov-catalog-v4-v2",
                                "2026-08-31T18:10:00Z"),
                        source(
                                FederatedSourceSystem.DOE_OSTI,
                                "b".repeat(64),
                                "osti-run-1",
                                "osti-records-v1",
                                "2026-08-31T18:11:00Z")),
                1_000_000,
                original.compositionSha256(),
                OffsetDateTime.parse("2026-08-31T18:31:00Z"));

        store.save(original);

        assertThatThrownBy(() -> store.save(conflicting))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("different composition evidence");
    }

    private FederatedCompositeCorpusManifest manifest(
            String compositionSha256, String capturedAt, String dataRunId, String ostiRunId) {
        return new FederatedCompositeCorpusManifest(
                FederatedCompositeCorpusManifestService.COMPOSITION_VERSION,
                FederatedCompositeCorpusManifest.MODE,
                CorpusProfile.FEDERATED_1M,
                List.of(
                        source(
                                FederatedSourceSystem.DOE_OSTI,
                                "b".repeat(64),
                                ostiRunId,
                                "osti-records-v1",
                                "2026-08-31T18:11:00Z"),
                        source(
                                FederatedSourceSystem.DATA_GOV,
                                "a".repeat(64),
                                dataRunId,
                                "data-gov-catalog-v4-v2",
                                "2026-08-31T18:10:00Z")),
                1_000_000,
                compositionSha256,
                OffsetDateTime.parse(capturedAt));
    }

    private FederatedCompositeCorpusSource source(
            FederatedSourceSystem sourceSystem,
            String sha256,
            String runId,
            String adapterVersion,
            String capturedAt) {
        return new FederatedCompositeCorpusSource(
                sourceSystem,
                500_000,
                sourceSystem.name() + ":" + sha256,
                runId,
                adapterVersion,
                List.of(adapterVersion),
                500_000,
                sha256,
                OffsetDateTime.parse(capturedAt));
    }
}
