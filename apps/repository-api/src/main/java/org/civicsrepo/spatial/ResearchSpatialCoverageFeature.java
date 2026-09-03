package org.civicsrepo.spatial;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.Map;
import org.civicsrepo.generated.dto.ResearchObjectType;

/** One criteria- and viewport-bounded research object with publisher spatial geometry. */
public record ResearchSpatialCoverageFeature(
        String sourceSystem,
        String sourceIdentifier,
        String title,
        String publisher,
        String program,
        ResearchObjectType contentType,
        String sourceUrl,
        SpatialGeometryStatus geometryStatus,
        Map<String, Object> geometry,
        Double renderLon,
        Double renderLat,
        String renderPointMethod) {
    private static final ObjectMapper JACKSON_2_MAPPER = new ObjectMapper();
    private static final TypeReference<Map<String, Object>> GEOMETRY_TYPE = new TypeReference<>() {};

    /**
     * Bridge the Jackson 2 tree used by the persisted sidecar reader into plain Java JSON values.
     *
     * <p>Spring Boot 4 serializes HTTP responses with Jackson 3. Exposing a Jackson 2 {@link JsonNode}
     * directly makes Jackson 3 treat the node as a bean and emit introspection flags instead of the
     * publisher GeoJSON. Plain maps/lists/primitives are serializer-neutral and match the OpenAPI
     * geometry-object contract.
     */
    public ResearchSpatialCoverageFeature(
            String sourceSystem,
            String sourceIdentifier,
            String title,
            String publisher,
            String program,
            ResearchObjectType contentType,
            String sourceUrl,
            SpatialGeometryStatus geometryStatus,
            JsonNode geometry,
            Double renderLon,
            Double renderLat,
            String renderPointMethod) {
        this(
                sourceSystem,
                sourceIdentifier,
                title,
                publisher,
                program,
                contentType,
                sourceUrl,
                geometryStatus,
                toWireGeometry(geometry),
                renderLon,
                renderLat,
                renderPointMethod);
    }

    private static Map<String, Object> toWireGeometry(JsonNode geometry) {
        if (geometry == null || !geometry.isObject()) {
            throw new IllegalArgumentException("Research coverage geometry must be a GeoJSON object.");
        }
        return JACKSON_2_MAPPER.convertValue(geometry, GEOMETRY_TYPE);
    }
}
