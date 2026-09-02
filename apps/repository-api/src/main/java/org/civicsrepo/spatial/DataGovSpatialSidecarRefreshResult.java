package org.civicsrepo.spatial;

/** Operator result for one completed Data.gov spatial sidecar refresh. */
public record DataGovSpatialSidecarRefreshResult(
        ResearchSpatialSidecarBuild build,
        int pagesFetched,
        long sourceRowsFetched,
        long publisherShapeRows,
        long retainedRows,
        long quarantinedRows) {}
