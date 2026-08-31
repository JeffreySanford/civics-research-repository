package org.civicsrepo.federation;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.OffsetDateTime;
import org.civicsrepo.generated.dto.RepositorySource;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.jdbc.datasource.DriverManagerDataSource;

class JdbcFederatedCompositeCorpusProjectionEvidenceStoreTest {
    private JdbcFederatedCompositeCorpusProjectionEvidenceStore store;

    @BeforeEach
    void setUp() {
        DriverManagerDataSource dataSource = new DriverManagerDataSource(
                "jdbc:h2:mem:composite-projection-" + System.nanoTime() + ";MODE=PostgreSQL;DB_CLOSE_DELAY=-1",
                "sa",
                "");
        store = new JdbcFederatedCompositeCorpusProjectionEvidenceStore(JdbcClient.create(dataSource));
        store.createSchema();
    }

    @Test
    void preservesProjectionHistoryForTheSameCompositionIdentity() {
        FederatedCompositeCorpusProjectionEvidence first = evidence(
                "a".repeat(64), "b".repeat(64), "2026-08-31T20:30:00Z");
        FederatedCompositeCorpusProjectionEvidence second = evidence(
                "a".repeat(64), "c".repeat(64), "2026-08-31T21:30:00Z");

        store.save(first);
        store.save(second);

        assertThat(store.findLatestByCompositionSha256(first.compositionSha256())).contains(second);
        assertThat(store.findRecent(CorpusProfile.FEDERATED_1M, 10)).containsExactly(second, first);
    }

    @Test
    void identicalCompositionAndProjectionRecaptureIsIdempotent() {
        FederatedCompositeCorpusProjectionEvidence original = evidence(
                "a".repeat(64), "b".repeat(64), "2026-08-31T20:30:00Z");
        FederatedCompositeCorpusProjectionEvidence recaptured = new FederatedCompositeCorpusProjectionEvidence(
                original.compositionSha256(),
                original.corpusProfile(),
                original.federatedRecordCount(),
                original.projectionId(),
                original.projectionSource(),
                original.projectionObjectCount(),
                original.projectionRebuiltAt(),
                OffsetDateTime.parse("2026-08-31T22:30:00Z"));

        store.save(original);
        store.save(recaptured);

        assertThat(store.findLatestByCompositionSha256(original.compositionSha256())).contains(recaptured);
        assertThat(store.findRecent(CorpusProfile.FEDERATED_1M, 10)).containsExactly(recaptured);
    }

    private FederatedCompositeCorpusProjectionEvidence evidence(
            String compositionSha, String projectionId, String linkedAt) {
        OffsetDateTime linked = OffsetDateTime.parse(linkedAt);
        return new FederatedCompositeCorpusProjectionEvidence(
                compositionSha,
                CorpusProfile.FEDERATED_1M,
                1_000_000,
                projectionId,
                RepositorySource.REPOSITORY,
                1_000_181,
                linked.minusMinutes(1),
                linked);
    }
}
