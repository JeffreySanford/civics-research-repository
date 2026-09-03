import type {
  ResearchSpatialCoverageFeature,
  ResearchSpatialCoverageResponse,
  SearchQuery,
} from 'repository-api-client';

/** UI-facing summary of one build-pinned, viewport-bounded spatial response. */
export interface ResearchCoverageSummary {
  readonly query: SearchQuery;
  readonly buildId: string;
  readonly sourceSystem: string;
  readonly sourceSnapshotAt: string;
  readonly capturedAt: string;
  readonly compositionSha256: string;
  readonly projectionId: string;
  readonly criteriaFingerprint: string;
  readonly totalResults: number;
  readonly mappedResults: number;
  readonly unmappedResults: number;
  readonly quarantinedResults: number;
  readonly unanchoredAntimeridianResults: number;
  readonly viewportMappedResults: number;
  readonly returnedFeatures: number;
  readonly omittedFeatures: number;
  readonly featureLimit: number;
  readonly truncated: boolean;
  readonly features: readonly ResearchSpatialCoverageFeature[];
}

/**
 * Adapts the bounded spatial API into the Maps presentation model without changing its semantics.
 *
 * The backend owns research-object matching and publisher-geometry eligibility. The client does
 * not reinterpret publisher/institution locations, infer geography from labels, or recompute
 * mapped/unmapped counts. That keeps the visual map and semantic table on the same evidence.
 */
export function buildResearchCoverageSummary(
  response: ResearchSpatialCoverageResponse,
  query: SearchQuery,
): ResearchCoverageSummary {
  return {
    query,
    buildId: response.buildId,
    sourceSystem: response.sourceSystem,
    sourceSnapshotAt: response.sourceSnapshotAt,
    capturedAt: response.capturedAt,
    compositionSha256: response.compositionSha256,
    projectionId: response.projectionId,
    criteriaFingerprint: response.criteriaFingerprint,
    totalResults: response.summary.matchingRecords,
    mappedResults: response.summary.mappedRecords,
    unmappedResults: response.summary.unmappedRecords,
    quarantinedResults: response.summary.quarantinedRecords,
    unanchoredAntimeridianResults:
      response.summary.unanchoredAntimeridianRecords,
    viewportMappedResults: response.summary.viewportMappedRecords,
    returnedFeatures: response.summary.returnedFeatures,
    omittedFeatures: response.summary.omittedFeatures,
    featureLimit: response.summary.featureLimit,
    truncated: response.summary.truncated,
    features: response.features,
  };
}
