package org.civicsrepo.spatial;

import java.time.OffsetDateTime;
import java.util.List;

/** Stable bounded spatial response for the later Maps Research Coverage experience. */
public record ResearchSpatialCoverageResponse(
        String buildId,
        String sourceSystem,
        int schemaVersion,
        OffsetDateTime sourceSnapshotAt,
        OffsetDateTime capturedAt,
        String compositionSha256,
        String projectionId,
        String criteriaFingerprint,
        ResearchSpatialViewport viewport,
        ResearchSpatialCoverageSummary summary,
        List<ResearchSpatialCoverageFeature> features) {
    public ResearchSpatialCoverageResponse {
        features = features == null ? List.of() : List.copyOf(features);
    }
}
