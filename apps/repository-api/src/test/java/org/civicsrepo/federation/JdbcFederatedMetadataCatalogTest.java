package org.civicsrepo.federation;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.URI;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import org.civicsrepo.generated.dto.ResearchObjectType;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.jdbc.datasource.DriverManagerDataSource;

class JdbcFederatedMetadataCatalogTest {
    private JdbcFederatedMetadataCatalog catalog;
    private JdbcHarvestCheckpointStore checkpoints;

    @BeforeEach
    void setUp() {
        DriverManagerDataSource dataSource = new DriverManagerDataSource(
                "jdbc:h2:mem:federation-" + System.nanoTime() + ";MODE=PostgreSQL;DB_CLOSE_DELAY=-1", "sa", "");
        JdbcClient jdbcClient = JdbcClient.create(dataSource);
        catalog = new JdbcFederatedMetadataCatalog(jdbcClient, new ObjectMapper());
        catalog.createSchema();
        checkpoints = new JdbcHarvestCheckpointStore(jdbcClient);
        checkpoints.createSchema();
    }

    @Test
    void upsertsByNamespacedIdentityAndPagesByStableId() {
        FederatedResearchRecord first = record("001", "First title");
        FederatedResearchRecord second = record("002", "Second title");
        catalog.upsertBatch(List.of(first, second));

        catalog.upsertBatch(List.of(record("001", "Updated title")));

        assertEquals(2, catalog.count());
        assertEquals("Updated title", catalog.findById("DOE_OSTI:001").orElseThrow().title());
        assertEquals(List.of("DOE_OSTI:001"), catalog.findAfterId(null, 1).stream().map(FederatedResearchRecord::id).toList());
        assertEquals(List.of("DOE_OSTI:002"), catalog.findAfterId("DOE_OSTI:001", 10).stream()
                .map(FederatedResearchRecord::id)
                .toList());
        assertEquals(List.of("Author One"), catalog.findById("DOE_OSTI:001").orElseThrow().authors());
        assertEquals("value", catalog.findById("DOE_OSTI:001").orElseThrow().sourceMetadata().get("key"));
    }

    @Test
    void persistsAndClearsHarvestCheckpoint() {
        OffsetDateTime now = OffsetDateTime.now();
        checkpoints.save(new HarvestCheckpoint(FederatedSourceSystem.DOE_OSTI, "cursor-2", 200, now));

        HarvestCheckpoint checkpoint = checkpoints.find(FederatedSourceSystem.DOE_OSTI).orElseThrow();
        assertEquals("cursor-2", checkpoint.cursor());
        assertEquals(200, checkpoint.acceptedCount());

        checkpoints.clear(FederatedSourceSystem.DOE_OSTI);
        assertTrue(checkpoints.find(FederatedSourceSystem.DOE_OSTI).isEmpty());
    }

    private FederatedResearchRecord record(String sourceIdentifier, String title) {
        return new FederatedResearchRecord(
                FederatedSourceSystem.DOE_OSTI,
                sourceIdentifier,
                title,
                "Summary",
                "U.S. Department of Energy",
                "Office of Science",
                ResearchObjectType.PUBLICATION,
                URI.create("https://www.osti.gov/biblio/" + sourceIdentifier),
                null,
                OffsetDateTime.parse("2026-08-29T12:00:00Z"),
                "test-adapter",
                List.of("Author One"),
                List.of("Energy"),
                Map.of("key", "value"));
    }
}
