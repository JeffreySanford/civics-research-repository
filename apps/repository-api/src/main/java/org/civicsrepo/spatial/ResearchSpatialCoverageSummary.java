package org.civicsrepo.spatial;

/** Counts that keep matching research objects distinct from their map-rendering eligibility. */
public record ResearchSpatialCoverageSummary(
        long matchingRecords,
        long mappedRecords,
        long unmappedRecords,
        long quarantinedRecords,
        long unanchoredAntimeridianRecords,
        long viewportMappedRecords,
        int returnedFeatures,
        long omittedFeatures,
        int featureLimit,
        boolean truncated) {}
