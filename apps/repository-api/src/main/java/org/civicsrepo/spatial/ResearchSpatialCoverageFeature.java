package org.civicsrepo.spatial;

import com.fasterxml.jackson.databind.JsonNode;
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
        JsonNode geometry,
        Double renderLon,
        Double renderLat,
        String renderPointMethod) {}
