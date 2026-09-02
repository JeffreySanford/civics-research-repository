import assert from 'node:assert/strict';
import test from 'node:test';

import {
  analyzeCentroid,
  analyzeGeoJsonGeometry,
  classifyDcatSpatial,
  formatMarkdown,
  parseArgs,
  probeDataGovSpatialGeometry,
} from './data-gov-spatial-geometry-census.mjs';

function jsonResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => null },
    json: async () => body,
  };
}

test('analyzes valid polygon structure and complexity', () => {
  const result = analyzeGeoJsonGeometry({
    type: 'Polygon',
    coordinates: [
      [
        [-10, 20],
        [10, 20],
        [10, 40],
        [-10, 40],
        [-10, 20],
      ],
    ],
  });
  assert.equal(result.type, 'Polygon');
  assert.equal(result.structurallyValid, true);
  assert.equal(result.positionCount, 5);
  assert.equal(result.empty, false);
  assert.equal(result.longitudeSpanDegrees, 20);
  assert.equal(result.longitudeSpanOver180, false);
  assert.ok(result.serializedBytes > 0);
});

test('flags invalid rings and coordinate-domain anomalies without claiming topology', () => {
  const result = analyzeGeoJsonGeometry({
    type: 'Polygon',
    coordinates: [
      [
        [170, 10],
        [-170, 10],
        [-170, 95],
        [170, 11],
      ],
    ],
  });
  assert.equal(result.structurallyValid, false);
  assert.equal(result.ringClosureFailureCount, 1);
  assert.equal(result.outOfRangePositionCount, 1);
  assert.equal(result.longitudeSpanOver180, true);
});

test('marks empty polygon families structurally invalid', () => {
  for (const geometry of [
    { type: 'Polygon', coordinates: [] },
    { type: 'MultiPolygon', coordinates: [] },
  ]) {
    const result = analyzeGeoJsonGeometry(geometry);
    assert.equal(result.structurallyValid, false);
    assert.equal(result.empty, true);
    assert.equal(result.insufficientElementCount, 1);
  }
});

test('validates centroids as GeoJSON points', () => {
  assert.equal(
    analyzeCentroid({ type: 'Point', coordinates: [-100, 40] }).validPoint,
    true,
  );
  assert.equal(
    analyzeCentroid({ type: 'Point', coordinates: [-200, 40] }).validPoint,
    false,
  );
  assert.equal(
    analyzeCentroid({ type: 'Polygon', coordinates: [] }).validPoint,
    false,
  );
});

test('classifies dcat spatial text and exposes ordering anomalies', () => {
  const bbox = classifyDcatSpatial('-83.1,32.0,-121.9,48.0');
  assert.equal(bbox.family, 'comma-bbox-four-numeric');
  assert.deepEqual(bbox.anomalies, ['west-greater-than-east']);
  assert.equal(classifyDcatSpatial('{"type":"Polygon"}').family, 'json-object');
  assert.equal(classifyDcatSpatial('United States').family, 'free-text');
});

test('traverses source pages, collapses duplicate identifiers, and summarizes geometry once per C2 id', async () => {
  const pages = [
    {
      after: 'two',
      results: [
        {
          identifier: 'a',
          title: 'A',
          dcat: { spatial: '-10,20,10,40' },
          spatial_shape: {
            type: 'Polygon',
            coordinates: [
              [
                [-10, 20],
                [10, 20],
                [10, 40],
                [-10, 40],
                [-10, 20],
              ],
            ],
          },
          spatial_centroid: { type: 'Point', coordinates: [0, 30] },
        },
        {
          identifier: 'outside',
          spatial_shape: { type: 'Point', coordinates: [1, 1] },
        },
      ],
    },
    {
      results: [
        {
          identifier: 'a',
          spatial_shape: { type: 'Polygon', coordinates: [] },
        },
        {
          identifier: 'b',
          dcat: { spatial: 'United States' },
          spatial_shape: { type: 'Point', coordinates: [-150, 60] },
          spatial_centroid: { type: 'Point', coordinates: [-150, 60] },
        },
      ],
    },
  ];
  const progress = [];
  const result = await probeDataGovSpatialGeometry({
    retainedIdentifiers: new Set(['a', 'b']),
    apiKey: 'personal',
    progressEveryPages: 1,
    fetchImpl: async () => jsonResponse(pages.shift()),
    onProgress: (entry) => progress.push(entry),
  });

  assert.equal(result.sourceSpatialRowCount, 4);
  assert.equal(result.sourceSpatialRecordCount, 3);
  assert.equal(result.duplicateSourceRowCount, 1);
  assert.equal(result.duplicateSourceIdentifierCount, 1);
  assert.equal(result.retainedSpatialRecordCount, 2);
  assert.equal(result.shape.presentCount, 2);
  assert.equal(result.shape.structurallyValidCount, 2);
  assert.equal(result.shape.variantIdentifierCount, 1);
  assert.equal(result.centroid.validPointCount, 2);
  assert.equal(result.dcatSpatial.presentCount, 2);
  assert.equal(progress.length, 2);
  assert.equal(progress[0].window.startPage, 1);
  assert.equal(progress[1].window.startPage, 2);
  assert.equal(progress[1].window.duplicateSourceRowCount, 1);
});

test('defaults to 100-page progress and supports pnpm separator', () => {
  assert.equal(parseArgs([]).progressEveryPages, 100);
  const parsed = parseArgs([
    '--',
    '--progress-every',
    '25',
    '--sample-limit',
    '5',
  ]);
  assert.equal(parsed.progressEveryPages, 25);
  assert.equal(parsed.sampleLimit, 5);
});

test('markdown preserves structural-validity caveat and C2 binding', () => {
  const report = {
    capturedAt: '2026-09-02T00:00:00Z',
    retainedDataGovIdentifierCount: 500000,
    retainedSpatialRecordCount: 1,
    sourceSpatialRowCount: 1,
    sourceSpatialRecordCount: 1,
    duplicateSourceRowCount: 0,
    duplicateSourceIdentifierCount: 0,
    pagesFetched: 1,
    scaleCertification: {
      profile: 'FEDERATED_1M',
      capturedAt: '2026-09-02T00:00:00Z',
      compositionSha256: 'a'.repeat(64),
      projectionId: 'b'.repeat(64),
      projectionObjectCount: 1000181,
    },
    shape: {
      presentCount: 1,
      structurallyValidCount: 1,
      structurallyInvalidCount: 0,
      emptyCount: 0,
      outOfRangeRecordCount: 0,
      longitudeSpanOver180RecordCount: 0,
      variantIdentifierCount: 0,
      types: { Point: 1 },
      complexityBuckets: { '0-5': 1 },
      serializedSizeBuckets: { '<=1KiB': 1 },
      positionCountPercentiles: { p50: 1, p90: 1, p95: 1, p99: 1, max: 1 },
      serializedBytesPercentiles: {
        p50: 50,
        p90: 50,
        p95: 50,
        p99: 50,
        max: 50,
      },
    },
    centroid: {
      presentCount: 1,
      validPointCount: 1,
      invalidCount: 0,
      outOfRangeRecordCount: 0,
    },
    dcatSpatial: {
      presentCount: 1,
      westGreaterThanEastCount: 0,
      southGreaterThanNorthCount: 0,
      longitudeSpanOver180Count: 0,
      families: { 'free-text': 1 },
    },
    anomalySamples: [],
  };
  const markdown = formatMarkdown(report);
  assert.match(markdown, /not.*topological-validity certification/i);
  assert.match(markdown, /Composition SHA-256/);
  assert.match(markdown, /publisher-supplied `spatial_shape`/i);
});
