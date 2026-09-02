package org.civicsrepo.spatial;

import java.time.OffsetDateTime;
import java.util.Objects;
import org.civicsrepo.federation.FederatedSourceSystem;

/** One publisher-supplied spatial observation associated with a retained federated research object. */
public record ResearchSpatialSidecarRecord(
        FederatedSourceSystem sourceSystem,
        String sourceIdentifier,
        int schemaVersion,
        OffsetDateTime sourceSnapshotAt,
        OffsetDateTime capturedAt,
        String compositionSha256,
        String projectionId,
        String geometryJson,
        String geometryType,
        SpatialGeometryStatus geometryStatus,
        Double minLon,
        Double minLat,
        Double maxLon,
        Double maxLat,
        Double sourceCentroidLon,
        Double sourceCentroidLat,
        String sourceCentroidMethod,
        Double renderLon,
        Double renderLat,
        String renderPointMethod,
        String rawDcatSpatial,
        String provenanceJson,
        String validationJson) {

    public ResearchSpatialSidecarRecord {
        Objects.requireNonNull(sourceSystem, "sourceSystem");
        sourceIdentifier = requireText(sourceIdentifier, "sourceIdentifier");
        if (schemaVersion < 1) {
            throw new IllegalArgumentException("schemaVersion must be positive");
        }
        Objects.requireNonNull(sourceSnapshotAt, "sourceSnapshotAt");
        Objects.requireNonNull(capturedAt, "capturedAt");
        compositionSha256 = requireSha(compositionSha256, "compositionSha256");
        projectionId = requireSha(projectionId, "projectionId");
        geometryJson = requireText(geometryJson, "geometryJson");
        geometryType = requireText(geometryType, "geometryType");
        Objects.requireNonNull(geometryStatus, "geometryStatus");
        provenanceJson = requireText(provenanceJson, "provenanceJson");
        validationJson = requireText(validationJson, "validationJson");
        requirePair(minLon, maxLon, "longitude bounds");
        requirePair(minLat, maxLat, "latitude bounds");
        requirePair(sourceCentroidLon, sourceCentroidLat, "source centroid");
        requirePair(renderLon, renderLat, "render point");
        validateCoordinates(minLon, minLat, maxLon, maxLat);
        validatePoint(sourceCentroidLon, sourceCentroidLat, "source centroid");
        validatePoint(renderLon, renderLat, "render point");
        if (minLon != null && maxLon != null && minLon > maxLon) {
            throw new IllegalArgumentException("minLon must not exceed maxLon");
        }
        if (minLat != null && maxLat != null && minLat > maxLat) {
            throw new IllegalArgumentException("minLat must not exceed maxLat");
        }
        if (sourceCentroidLon != null) {
            sourceCentroidMethod = requireText(sourceCentroidMethod, "sourceCentroidMethod");
        }
        if (renderLon != null) {
            renderPointMethod = requireText(renderPointMethod, "renderPointMethod");
        }
    }

    public boolean queryableGeometry() {
        return geometryStatus != SpatialGeometryStatus.QUARANTINED
                && minLon != null
                && minLat != null
                && maxLon != null
                && maxLat != null;
    }

    private static void requirePair(Object left, Object right, String field) {
        if ((left == null) != (right == null)) {
            throw new IllegalArgumentException(field + " must either be fully present or fully absent");
        }
    }

    private static void validateCoordinates(Double minLon, Double minLat, Double maxLon, Double maxLat) {
        if (minLon == null) {
            return;
        }
        validatePoint(minLon, minLat, "minimum bounds");
        validatePoint(maxLon, maxLat, "maximum bounds");
    }

    private static void validatePoint(Double lon, Double lat, String field) {
        if (lon == null) {
            return;
        }
        if (!Double.isFinite(lon) || !Double.isFinite(lat) || lon < -180 || lon > 180 || lat < -90 || lat > 90) {
            throw new IllegalArgumentException(field + " coordinates are outside the WGS84 domain");
        }
    }

    private static String requireText(String value, String field) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException(field + " must not be blank");
        }
        return value.trim();
    }

    private static String requireSha(String value, String field) {
        if (value == null || !value.matches("[0-9a-f]{64}")) {
            throw new IllegalArgumentException(field + " must be a lowercase SHA-256 hex digest");
        }
        return value;
    }
}
