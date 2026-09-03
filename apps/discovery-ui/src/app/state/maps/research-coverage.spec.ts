import { describe, expect, it } from 'vitest';
import type {
  ResearchSpatialCoverageResponse,
  SearchQuery,
} from 'repository-api-client';
import { buildResearchCoverageSummary } from './research-coverage';

function response(): ResearchSpatialCoverageResponse {
  return {
    buildId: 'spatial-build-42',
    sourceSystem: 'DATA_GOV',
    schemaVersion: 1,
    sourceSnapshotAt: '2026-09-02T12:00:00Z',
    capturedAt: '2026-09-02T12:05:00Z',
    compositionSha256: 'a'.repeat(64),
    projectionId: 'projection-9',
    criteriaFingerprint: 'criteria-123',
    viewport: {
      west: -125,
      south: 30,
      east: -110,
      north: 45,
    },
    summary: {
      matchingRecords: 440379,
      mappedRecords: 418462,
      unmappedRecords: 21917,
      quarantinedRecords: 679,
      unanchoredAntimeridianRecords: 12,
      viewportMappedRecords: 225,
      returnedFeatures: 200,
      omittedFeatures: 25,
      featureLimit: 200,
      truncated: true,
    },
    features: [
      {
        sourceSystem: 'DATA_GOV',
        sourceIdentifier: 'dataset-1',
        title: 'Publisher polygon',
        publisher: 'Example Agency',
        program: 'Climate',
        contentType: 'DATASET',
        sourceUrl: 'https://catalog.data.gov/dataset/example',
        geometryStatus: 'VALID',
        geometry: {
          type: 'Polygon',
          coordinates: [
            [
              [-120, 35],
              [-119, 35],
              [-119, 36],
              [-120, 35],
            ],
          ],
        },
        renderLon: -119.5,
        renderLat: 35.5,
        renderPointMethod: 'SHAPE_BOUNDS_CENTER',
      },
    ],
  } as ResearchSpatialCoverageResponse;
}

describe('buildResearchCoverageSummary', () => {
  it('preserves backend-owned matching, mapping, truncation, and build evidence', () => {
    const query: SearchQuery = {
      q: 'climate',
      programs: ['Climate'],
      sourceSystem: 'DATA_GOV',
    };

    const summary = buildResearchCoverageSummary(response(), query);

    expect(summary.query).toEqual(query);
    expect(summary.buildId).toBe('spatial-build-42');
    expect(summary.projectionId).toBe('projection-9');
    expect(summary.criteriaFingerprint).toBe('criteria-123');
    expect(summary.totalResults).toBe(440379);
    expect(summary.mappedResults).toBe(418462);
    expect(summary.unmappedResults).toBe(21917);
    expect(summary.quarantinedResults).toBe(679);
    expect(summary.unanchoredAntimeridianResults).toBe(12);
    expect(summary.viewportMappedResults).toBe(225);
    expect(summary.returnedFeatures).toBe(200);
    expect(summary.omittedFeatures).toBe(25);
    expect(summary.featureLimit).toBe(200);
    expect(summary.truncated).toBe(true);
  });

  it('passes the exact bounded feature list through for both map and semantic rendering', () => {
    const bounded = response();
    const summary = buildResearchCoverageSummary(bounded, {});

    expect(summary.features).toBe(bounded.features);
    expect(summary.features).toHaveLength(1);
    expect(summary.features[0]?.sourceIdentifier).toBe('dataset-1');
    expect(summary.features[0]?.geometryStatus).toBe('VALID');
  });
});
