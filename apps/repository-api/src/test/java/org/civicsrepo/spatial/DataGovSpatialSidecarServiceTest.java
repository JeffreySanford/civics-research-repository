package org.civicsrepo.spatial;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.net.http.HttpClient;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import javax.sql.DataSource;
import org.civicsrepo.federation.CorpusProfile;
import org.civicsrepo.federation.CorpusProfileActivation;
import org.civicsrepo.federation.CorpusProfileActivationStore;
import org.civicsrepo.federation.FederatedCompositeCorpusProjectionEvidence;
import org.civicsrepo.federation.FederatedCompositeCorpusProjectionEvidenceStore;
import org.civicsrepo.federation.FederatedMetadataCatalog;
import org.civicsrepo.federation.FederatedResearchRecord;
import org.civicsrepo.federation.FederatedSourceSystem;
import org.civicsrepo.generated.dto.RepositorySource;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.jdbc.datasource.DriverManagerDataSource;

class DataGovSpatialSidecarServiceTest {
    private static final String COMPOSITION = "a".repeat(64);
    private static final String PROJECTION = "b".repeat(64);
    private static final OffsetDateTime NOW = OffsetDateTime.parse("2026-09-02T23:45:00Z");

    private HttpServer server;
    private JdbcResearchSpatialSidecarStore store;
    private DataGovSpatialSidecarService service;

    @BeforeEach
    void setUp() throws IOException {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/search", this::handleSearch);
        server.start();

        DriverManagerDataSource dataSource = new DriverManagerDataSource(
                "jdbc:h2:mem:spatial-sidecar-service-" + System.nanoTime() + ";MODE=PostgreSQL;DB_CLOSE_DELAY=-1",
                "sa",
                "");
        createRetainedIdentityTable(dataSource);
        store = new JdbcResearchSpatialSidecarStore(JdbcClient.create(dataSource), dataSource);
        store.createSchema();

        String searchUrl = "http://127.0.0.1:" + server.getAddress().getPort() + "/search";
        service = newService(searchUrl, "personal-test-key", store);
    }

    @AfterEach
    void tearDown() {
        server.stop(0);
    }

    @Test
    void rebuildsAllGeospatialEvidenceButPersistsOnlyRetainedC2Identities() {
        DataGovSpatialSidecarRefreshResult result = service.rebuild(1_000, 10);

        assertThat(result.pagesFetched()).isEqualTo(1);
        assertThat(result.sourceRowsFetched()).isEqualTo(3);
        assertThat(result.publisherShapeRows()).isEqualTo(2);
        assertThat(result.retainedRows()).isEqualTo(2);
        assertThat(result.sourceQuarantinedShapeRows()).isZero();
        assertThat(result.build().status()).isEqualTo(ResearchSpatialSidecarBuild.Status.COMPLETE);
        assertThat(store.countActive(FederatedSourceSystem.DATA_GOV)).isEqualTo(2);

        ResearchSpatialSidecarRecord retained = store
                .findActive(FederatedSourceSystem.DATA_GOV, "retained-1")
                .orElseThrow();
        assertThat(retained.compositionSha256()).isEqualTo(COMPOSITION);
        assertThat(retained.projectionId()).isEqualTo(PROJECTION);
        assertThat(retained.geometryStatus()).isEqualTo(SpatialGeometryStatus.VALID);
        assertThat(retained.sourceCentroidMethod()).isEqualTo("DATA_GOV_VERTEX_MEAN");
        assertThat(retained.renderPointMethod()).isEqualTo("SHAPE_BOUNDS_CENTER");
        assertThat(retained.renderLon()).isEqualTo(-100.0);
        assertThat(retained.renderLat()).isEqualTo(47.0);
        assertThat(retained.rawDcatSpatial()).isEqualTo("-101,46,-99,48");
        assertThat(retained.provenanceJson()).contains("spatial_shape", "spatial_centroid");
        assertThat(retained.queryableGeometry()).isTrue();

        ResearchSpatialSidecarRecord unmapped = store
                .findActive(FederatedSourceSystem.DATA_GOV, "retained-no-shape")
                .orElseThrow();
        assertThat(unmapped.geometryStatus()).isEqualTo(SpatialGeometryStatus.NO_PUBLISHER_GEOMETRY);
        assertThat(unmapped.geometryJson()).isNull();
        assertThat(unmapped.geometryType()).isNull();
        assertThat(unmapped.sourceCentroidLon()).isEqualTo(-96.8);
        assertThat(unmapped.sourceCentroidLat()).isEqualTo(46.9);
        assertThat(unmapped.renderLon()).isNull();
        assertThat(unmapped.rawDcatSpatial()).isEqualTo("North Dakota");
        assertThat(unmapped.provenanceJson()).contains("DATA_GOV_GEOSPATIAL_FILTER", "NONE", "dcat.spatial");
        assertThat(unmapped.queryableGeometry()).isFalse();

        assertThat(store.findActive(FederatedSourceSystem.DATA_GOV, "not-retained")).isEmpty();
    }

    @Test
    void refusesDemoKeyForFullSidecarTraversal() {
        String searchUrl = "http://127.0.0.1:" + server.getAddress().getPort() + "/search";
        DataGovSpatialSidecarService demoKeyService = newService(searchUrl, "DEMO_KEY", store);

        assertThatThrownBy(() -> demoKeyService.rebuild(1_000, 10))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("personal");
    }

    private DataGovSpatialSidecarService newService(
            String searchUrl, String apiKey, ResearchSpatialSidecarStore sidecarStore) {
        FederatedCompositeCorpusProjectionEvidence evidence = new FederatedCompositeCorpusProjectionEvidence(
                COMPOSITION,
                CorpusProfile.FEDERATED_1M,
                1_000_000,
                PROJECTION,
                RepositorySource.FEDERATED,
                1_000_000,
                NOW,
                NOW);
        CorpusProfileActivation activation =
                new CorpusProfileActivation(CorpusProfile.FEDERATED_1M, PROJECTION, 1_000_000, NOW);

        return new DataGovSpatialSidecarService(
                searchUrl,
                apiKey,
                sidecarStore,
                retainedCatalog(),
                activationStore(activation),
                projectionEvidenceStore(evidence),
                HttpClient.newHttpClient(),
                new ObjectMapper(),
                Clock.fixed(Instant.parse("2026-09-02T23:45:00Z"), ZoneOffset.UTC));
    }

    private FederatedMetadataCatalog retainedCatalog() {
        return new FederatedMetadataCatalog() {
            @Override
            public void upsertBatch(List<FederatedResearchRecord> records) {}

            @Override
            public Optional<FederatedResearchRecord> findById(String id) {
                return Optional.empty();
            }

            @Override
            public List<FederatedResearchRecord> findAfterId(String afterId, int limit) {
                return List.of();
            }

            @Override
            public long count() {
                return 1_000_000;
            }

            @Override
            public long count(FederatedSourceSystem sourceSystem) {
                return sourceSystem == FederatedSourceSystem.DATA_GOV ? 500_000 : 0;
            }
        };
    }

    private CorpusProfileActivationStore activationStore(CorpusProfileActivation activation) {
        return new CorpusProfileActivationStore() {
            @Override
            public Optional<CorpusProfileActivation> findActive() {
                return Optional.of(activation);
            }

            @Override
            public void save(CorpusProfileActivation ignored) {}
        };
    }

    private FederatedCompositeCorpusProjectionEvidenceStore projectionEvidenceStore(
            FederatedCompositeCorpusProjectionEvidence evidence) {
        return new FederatedCompositeCorpusProjectionEvidenceStore() {
            @Override
            public void save(FederatedCompositeCorpusProjectionEvidence ignored) {}

            @Override
            public Optional<FederatedCompositeCorpusProjectionEvidence> findLatestByCompositionSha256(
                    String compositionSha256) {
                return compositionSha256.equals(COMPOSITION) ? Optional.of(evidence) : Optional.empty();
            }

            @Override
            public List<FederatedCompositeCorpusProjectionEvidence> findRecent(
                    CorpusProfile corpusProfile, int limit) {
                return corpusProfile == CorpusProfile.FEDERATED_1M ? List.of(evidence) : List.of();
            }
        };
    }

    private void createRetainedIdentityTable(DataSource dataSource) {
        JdbcClient jdbcClient = JdbcClient.create(dataSource);
        jdbcClient
                .sql(
                        """
                        create table federated_research_objects (
                            id text primary key,
                            source_system text not null,
                            source_identifier text not null,
                            unique (source_system, source_identifier)
                        )
                        """)
                .update();
        jdbcClient
                .sql("insert into federated_research_objects (id, source_system, source_identifier) values ('DATA_GOV:retained-1', 'DATA_GOV', 'retained-1')")
                .update();
        jdbcClient
                .sql("insert into federated_research_objects (id, source_system, source_identifier) values ('DATA_GOV:retained-no-shape', 'DATA_GOV', 'retained-no-shape')")
                .update();
    }

    private void handleSearch(HttpExchange exchange) throws IOException {
        assertThat(exchange.getRequestURI().getRawQuery()).contains("spatial_filter=geospatial", "per_page=1000");
        assertThat(exchange.getRequestHeaders().getFirst("X-Api-Key")).isEqualTo("personal-test-key");
        byte[] response = """
                {
                  "results": [
                    {
                      "identifier": "retained-1",
                      "spatial_shape": {
                        "type": "Polygon",
                        "coordinates": [[[-101,46],[-99,46],[-99,48],[-101,48],[-101,46]]]
                      },
                      "spatial_centroid": {"lat":47,"lon":-100},
                      "dcat": {"spatial":"-101,46,-99,48"}
                    },
                    {
                      "identifier": "retained-no-shape",
                      "spatial_centroid": {"lat":46.9,"lon":-96.8},
                      "dcat": {"spatial":"North Dakota"}
                    },
                    {
                      "identifier": "not-retained",
                      "spatial_shape": {
                        "type": "Point",
                        "coordinates": [-77,38]
                      },
                      "spatial_centroid": {"lat":38,"lon":-77},
                      "dcat": {"spatial":"Washington, DC"}
                    }
                  ]
                }
                """.getBytes(StandardCharsets.UTF_8);
        exchange.getResponseHeaders().set("Content-Type", "application/json");
        exchange.sendResponseHeaders(200, response.length);
        exchange.getResponseBody().write(response);
        exchange.close();
    }
}
