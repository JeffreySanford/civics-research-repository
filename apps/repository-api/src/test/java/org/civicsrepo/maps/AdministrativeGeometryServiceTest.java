package org.civicsrepo.maps;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.net.URLDecoder;
import java.net.http.HttpClient;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class AdministrativeGeometryServiceTest {
    private final AtomicInteger requests = new AtomicInteger();
    private HttpServer server;
    private AdministrativeGeometryService service;
    private String lastRawQuery;

    @BeforeEach
    void startServer() throws IOException {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/counties/query", this::handleCountyQuery);
        server.start();
        service = new AdministrativeGeometryService(
                "http://127.0.0.1:" + server.getAddress().getPort() + "/counties/query",
                HttpClient.newHttpClient(),
                new ObjectMapper());
    }

    @AfterEach
    void stopServer() {
        server.stop(0);
    }

    @Test
    void returnsValidatedCountyGeoJsonInStableGeoidOrder() {
        var geometry = service.countiesForState("38");

        assertThat(geometry.vintage()).isEqualTo(2025);
        assertThat(geometry.attribution()).isEqualTo("U.S. Census Bureau TIGERweb");
        assertThat(geometry.sourceUrl().toString()).endsWith("/counties");
        assertThat(geometry.geoJson().path("features"))
                .extracting((feature) -> feature.path("properties").path("GEOID").asText())
                .containsExactly("38001", "38017");

        String decodedQuery = URLDecoder.decode(lastRawQuery, StandardCharsets.UTF_8);
        assertThat(decodedQuery).contains("where=STATE='38'");
        assertThat(decodedQuery).contains("outFields=GEOID,STATE,COUNTY,BASENAME,NAME");
        assertThat(decodedQuery).contains("outSR=4326");
        assertThat(decodedQuery).contains("orderByFields=GEOID ASC");
        assertThat(decodedQuery).contains("f=geojson");
    }

    @Test
    void cachesOnlySuccessfulStateGeometry() {
        var first = service.countiesForState("38");
        first.geoJson().withArray("features").removeAll();

        var second = service.countiesForState("38");

        assertThat(requests).hasValue(1);
        assertThat(second.geoJson().path("features")).hasSize(2);
    }

    @Test
    void rejectsInvalidStateFipsBeforeCallingCensus() {
        assertThatThrownBy(() -> service.countiesForState("North Dakota"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("two digits");
        assertThat(requests).hasValue(0);
    }

    private void handleCountyQuery(HttpExchange exchange) throws IOException {
        requests.incrementAndGet();
        lastRawQuery = exchange.getRequestURI().getRawQuery();
        byte[] response = """
                {
                  "type": "FeatureCollection",
                  "features": [
                    {
                      "type": "Feature",
                      "properties": {
                        "GEOID": "38017",
                        "STATE": "38",
                        "COUNTY": "017",
                        "BASENAME": "Cass",
                        "NAME": "Cass County"
                      },
                      "geometry": {
                        "type": "Polygon",
                        "coordinates": [[[-97.5,46.6],[-96.8,46.6],[-96.8,47.1],[-97.5,47.1],[-97.5,46.6]]]
                      }
                    },
                    {
                      "type": "Feature",
                      "properties": {
                        "GEOID": "38001",
                        "STATE": "38",
                        "COUNTY": "001",
                        "BASENAME": "Adams",
                        "NAME": "Adams County"
                      },
                      "geometry": {
                        "type": "MultiPolygon",
                        "coordinates": [[[[-102.0,45.9],[-101.0,45.9],[-101.0,46.4],[-102.0,46.4],[-102.0,45.9]]]]
                      }
                    }
                  ]
                }
                """.getBytes(StandardCharsets.UTF_8);
        exchange.getResponseHeaders().set("Content-Type", "application/geo+json");
        exchange.sendResponseHeaders(200, response.length);
        exchange.getResponseBody().write(response);
        exchange.close();
    }
}
