import assert from 'node:assert/strict';
import test from 'node:test';

import {
  classifyCentroid,
  classifyDcatSpatialSemantics,
  formatMarkdown,
  inferFourNumberOrdering,
  parseArgs,
  pointMatchesBoundsCenter,
  pointWithinBounds,
  probeDataGovSpatialSemantics,
} from './data-gov-spatial-source-semantics.mjs';

test('classifies and normalizes supported centroid representations', () => {
  const cases = [
    [
      { type: 'Point', coordinates: [-77.1, 38.9] },
      'geojson-point-object',
    ],
    [{ coordinates: [-77.1, 38.9] }, 'coordinates-object'],
    [{ lat: 38.9, lon: -77.1 }, 'lat-lon-object'],
    [{ lat: 38.9, lng: -77.1 }, 'lat-lng-object'],
    [
      { latitude: 38.9, longitude: -77.1 },
      'latitude-longitude-object',
    ],
    [[-77.1, 38.9], 'coordinate-array'],
    ['POINT(-77.1 38.9)', 'wkt-point-string'],
  ];

  for (const [value, family] of cases) {
    const result = classifyCentroid(value);
    assert.equal(result.family, family);
    assert.deepEqual(result.point, { lon: -77.1, lat: 38.9 });
    assert.equal(result.validCoordinates, true);
  }

  const invalid = classifyCentroid({ lat: 95, lon: -77 });
  assert.equal(invalid.family, 'lat-lon-object');
  assert.equal(invalid.validCoordinates, false);
});

test('preserves unknown centroid shapes instead of mislabeling them GeoJSON', () => {
  const result = classifyCentroid({ x: -77, y: 39, source: 'publisher' });
  assert.equal(result.family, 'object-other');
  assert.equal(result.point, null);
  assert.deepEqual(result.keys, ['source', 'x', 'y']);

  const ambiguous = classifyCentroid('38.9,-77.1');
  assert.equal(ambiguous.family, 'comma-two-numeric-ambiguous');
  assert.equal(ambiguous.point, null);
});

test('infers four-number DCAT ordering against independent shape bounds', () => {
  const bounds = {
    minLon: -121.97222,
    minLat: 32.082294,
    maxLon: -83.157821,
    maxLat: 48.078465,
  };

  const eastSouthWestNorth = classifyDcatSpatialSemantics(
    '-83.157821,32.082294,-121.97222,48.078465',
    bounds,
  );
  assert.equal(eastSouthWestNorth.family, 'comma-four-numeric');
  assert.equal(
    eastSouthWestNorth.inferredOrdering,
    'east-south-west-north',
  );
  assert.deepEqual(eastSouthWestNorth.orderingMatches, [
    'east-south-west-north',
  ]);

  const westSouthEastNorth = classifyDcatSpatialSemantics(
    '-121.97222,32.082294,-83.157821,48.078465',
    bounds,
  );
  assert.equal(
    westSouthEastNorth.inferredOrdering,
    'west-south-east-north',
  );
});

test('keeps four-number DCAT values ambiguous when shape evidence is not decisive', () => {
  const noShape = classifyDcatSpatialSemantics('-10,-5,10,5');
  assert.equal(noShape.inferredOrdering, null);
  assert.deepEqual(noShape.orderingMatches, []);

  const symmetric = inferFourNumberOrdering(
    [-10, -10, 10, 10],
    { minLon: -10, minLat: -10, maxLon: 10, maxLat: 10 },
  );
  assert.equal(symmetric.inferredOrdering, null);
  assert.ok(symmetric.matches.length > 1);
});

test('validates normalized centroids against publisher shape bounds', () => {
  const bounds = { minLon: -10, minLat: 30, maxLon: 10, maxLat: 50 };
  assert.equal(pointWithinBounds({ lon: 0, lat: 40 }, bounds), true);
  assert.equal(pointMatchesBoundsCenter({ lon: 0, lat: 40 }, bounds), true);
  assert.equal(pointWithinBounds({ lon: 20, lat: 40 }, bounds), false);
});

test('traverses current Data.gov semantics with duplicate collapse and C2 intersection', async () => {
  const retainedIdentifiers = new Set(['a', 'b']);
  const pages = [
    {
      after: 'next',
      results: [
        {
          identifier: 'a',
          title: 'A',
          spatial_shape: {
            type: 'Polygon',
            coordinates: [
              [
                [-10, 30],
                [10, 30],
                [10, 50],
                [-10, 50],
                [-10, 30],
              ],
            ],
          },
          spatial_centroid: { lat: 40, lon: 0 },
          dcat: { spatial: '10,30,-10,50' },
        },
        {
          identifier: 'outside',
          spatial_shape: null,
          spatial_centroid: null,
          dcat: { spatial: 'United States' },
        },
      ],
    },
    {
      results: [
        {
          identifier: 'a',
          title: 'A duplicate',
          spatial_shape: {
            type: 'Polygon',
            coordinates: [
              [
                [-10, 30],
                [10, 30],
                [10, 50],
                [-10, 50],
                [-10, 30],
              ],
            ],
          },
          spatial_centroid: { lat: 40, lon: 0 },
          dcat: { spatial: '10,30,-10,50' },
        },
        {
          identifier: 'b',
          title: 'B',
          spatial_shape: {
            type: 'Polygon',
            coordinates: [
              [
                [-80, 35],
                [-70, 35],
                [-70, 45],
                [-80, 45],
                [-80, 35],
              ],
            ],
          },
          spatial_centroid: {
            type: 'Point',
            coordinates: [-75, 40],
          },
          dcat: { spatial: '-80,35,-70,45' },
        },
      ],
    },
  ];
  let index = 0;
  const progress = [];
  const result = await probeDataGovSpatialSemantics({
    retainedIdentifiers,
    apiKey: 'personal-key',
    pageSize: 2,
    progressEveryPages: 1,
    fetchImpl: async () =>
      new Response(JSON.stringify(pages[index++]), { status: 200 }),
    onProgress: (value) => progress.push(value),
  });

  assert.equal(result.sourceSpatialRowCount, 4);
  assert.equal(result.sourceSpatialRecordCount, 3);
  assert.equal(result.duplicateSourceRowCount, 1);
  assert.equal(result.duplicateSourceIdentifierCount, 1);
  assert.equal(result.retainedSpatialRecordCount, 2);
  assert.equal(result.centroid.presentCount, 2);
  assert.equal(result.centroid.validNormalizedPointCount, 2);
  assert.equal(result.centroid.withinShapeBoundsCount, 2);
  assert.equal(result.centroid.matchesShapeBoundsCenterCount, 2);
  assert.equal(result.dcatSpatial.uniqueOrderingMatchCount, 2);
  assert.equal(
    result.dcatSpatial.inferredOrderings['east-south-west-north'],
    1,
  );
  assert.equal(
    result.dcatSpatial.inferredOrderings['west-south-east-north'],
    1,
  );
  assert.equal(progress.length, 2);
  assert.equal(progress[1].done, true);
});

test('parses pnpm separators and defaults progress to 100 pages', () => {
  const args = parseArgs([
    '--',
    '--scale-evidence',
    'evidence.json',
    '--sample-limit',
    '12',
  ]);
  assert.equal(args.scaleEvidencePath, 'evidence.json');
  assert.equal(args.sampleLimit, 12);
  assert.equal(args.progressEveryPages, 100);
});

test('evidence wording refuses to canonicalize ambiguous DCAT ordering', () => {
  const markdown = formatMarkdown({
    capturedAt: '2026-09-02T00:00:00.000Z',
    retainedDataGovIdentifierCount: 500000,
    retainedSpatialRecordCount: 2,
    sourceSpatialRowCount: 2,
    sourceSpatialRecordCount: 2,
    duplicateSourceRowCount: 0,
    duplicateSourceIdentifierCount: 0,
    pagesFetched: 1,
    centroid: {
      presentCount: 1,
      normalizedPointCount: 1,
      validNormalizedPointCount: 1,
      outOfRangeNormalizedPointCount: 0,
      comparedToShapeBoundsCount: 1,
      withinShapeBoundsCount: 1,
      matchesShapeBoundsCenterCount: 1,
      families: { 'lat-lon-object': 1 },
    },
    dcatSpatial: {
      presentCount: 2,
      fourNumericCount: 1,
      fourNumericComparedToShapeCount: 1,
      uniqueOrderingMatchCount: 1,
      ambiguousOrderingMatchCount: 0,
      noOrderingMatchCount: 0,
      inferredOrderings: { 'east-south-west-north': 1 },
      families: { 'comma-four-numeric': 1, 'free-text': 1 },
    },
    samples: [],
  });

  assert.match(markdown, /not.*canonical bounding box/i);
  assert.match(
    markdown,
    /independently matches the publisher `spatial_shape` bounds/i,
  );
  assert.match(markdown, /primary geometry candidate/i);
});
