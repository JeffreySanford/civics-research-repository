package org.civicsrepo.spatial;

import java.util.List;
import java.util.Optional;
import org.civicsrepo.federation.FederatedSourceSystem;

/** Durable versioned storage for research-object spatial evidence outside the immutable C2 corpus. */
public interface ResearchSpatialSidecarStore {
    void beginBuild(ResearchSpatialSidecarBuild build);

    int upsertRetainedBatch(String buildId, List<ResearchSpatialSidecarRecord> records);

    long countBuildRows(String buildId);

    ResearchSpatialSidecarBuild completeAndActivate(String buildId);

    ResearchSpatialSidecarBuild failBuild(String buildId, String failureMessage);

    Optional<ResearchSpatialSidecarBuild> findActiveBuild(FederatedSourceSystem sourceSystem);

    Optional<ResearchSpatialSidecarRecord> findActive(
            FederatedSourceSystem sourceSystem, String sourceIdentifier);

    long countActive(FederatedSourceSystem sourceSystem);
}
