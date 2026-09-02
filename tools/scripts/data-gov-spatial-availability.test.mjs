import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  buildDataGovSpatialSearchUrl,
  buildRetainedIdentifiersSql,
  formatMarkdown,
  loadScaleCertification,
  normalizeScaleCertification,
  parseArgs,
  parsePsqlIdentifiers,
  probeDataGovSpatialSource,
  requirePersonalDataGovApiKey,
} from './data-gov-spatial-availability.mjs';

const REQUIRED_SCALE_CHECKS = [
  'preflight-ready-to-measure',
  'exact-source-recipe',
  'scale-evidence-valid',
  'active-profile',
  'persisted-activation-runtime-identity',
  'search-target-parity',
  'storage-evidence',
  'composition-projection-linkage',
  'public-search-data_gov-provenance',
  'public-search-doe_osti-provenance',
];

function passingScaleEvidence(overrides = {}) {
  return {
    kind: 'civics-scale-evidence-check',
    profile: 'FEDERATED_1M',
    status: 'PASS',
    targetFederatedRecordCount: 1_000_000,
    retainedFederatedRecordCount: 1_000_000,
    compositionSha256: 'a'.repeat(64),
    projectionId: 'b'.repeat(64),
    projectionObjectCount: 1_000_181,
    capturedAt: '2026-09-02T16:00:00.000Z',
    checks: REQUIRED_SCALE_CHECKS.map((id) => ({ id, status: 'PASS' })),
    ...overrides,
  };
}

async function tempDirectory(t) {
  const directory = await mkdtemp(path.join(tmpdir(), 'civics-spatial-scale-'));
  t.after(async () => {
    await rm(directory, { recursive: true, force: true });
  });
  return directory;
}

function jsonResponse(body, { status = 200, headers = {} } = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: {
      get(name) {
        return headers[name.toLowerCase()] ?? null;
      },
    },
    async json() {
      return body;
    },
  };
}

test('retained-identifier SQL is read-only and never scans harvestRecordRaw URL strings', () => {
  const sql = buildRetainedIdentifiersSql();
  assert.match(sql, /source_identifier/u);
  assert.match(sql, /source_system = 'DATA_GOV'/u);
  assert.doesNotMatch(sql, /harvestRecordRaw|source_metadata_json|"spatial"/u);
  assert.doesNotMatch(sql, /\b(update|delete|insert|truncate)\b/iu);
});

test('parses retained source identifiers into a deterministic set', () => {
  assert.deepEqual([...parsePsqlIdentifiers('\na\nb\na\n')], ['a', 'b']);
});

test('builds the documented Data.gov v4 geospatial cursor request', () => {
  const first = buildDataGovSpatialSearchUrl({ pageSize: 5000 });
  assert.equal(first.searchParams.get('per_page'), '1000');
  assert.equal(first.searchParams.get('sort'), 'last_harvested_date');
  assert.equal(first.searchParams.get('spatial_filter'), 'geospatial');
  assert.equal(first.searchParams.get('after'), null);

  const next = buildDataGovSpatialSearchUrl({ cursor: 'opaque==' });
  assert.equal(next.searchParams.get('after'), 'opaque==');
});

test('intersects current Data.gov geospatial pages with the retained C2 identifiers', async () => {
  const retainedIdentifiers = new Set([
    'retained-a',
    'retained-b',
    'retained-nonspatial',
  ]);
  const requests = [];
  const pages = [
    {
      after: 'next-token',
      results: [
        {
          identifier: 'retained-a',
          title: 'Retained A',
          has_spatial: true,
          spatial_centroid: { type: 'Point', coordinates: [-100, 40] },
          dcat: { spatial: 'United States' },
        },
        {
          identifier: 'outside-c2',
          title: 'Outside C2',
          spatial_shape: { type: 'Polygon', coordinates: [] },
          dcat: { spatial: '-120,30,-110,40' },
        },
      ],
    },
    {
      results: [
        {
          identifier: 'retained-b',
          title: 'Retained B',
          has_spatial: true,
          spatial_shape: { type: 'Polygon', coordinates: [] },
          dcat: { spatial: '-105,45,-95,49' },
        },
      ],
    },
  ];

  const result = await probeDataGovSpatialSource({
    retainedIdentifiers,
    apiKey: 'personal-key',
    fetchImpl: async (url, options) => {
      requests.push({
        url: String(url),
        apiKey: options.headers['X-Api-Key'],
      });
      return jsonResponse(pages.shift());
    },
  });

  assert.equal(requests.length, 2);
  assert.equal(requests[0].apiKey, 'personal-key');
  assert.match(requests[0].url, /spatial_filter=geospatial/u);
  assert.match(requests[1].url, /after=next-token/u);
  assert.equal(result.sourceSpatialRecordCount, 3);
  assert.equal(result.retainedRecordCount, 3);
  assert.equal(result.retainedSpatialRecordCount, 2);
  assert.equal(result.retainedSpatialPercent, 66.6667);
  assert.equal(result.unmatchedCurrentSourceSpatialRecords, 1);
  assert.deepEqual(result.matchedMetadataSignals, {
    hasSpatialTrue: 2,
    dcatSpatial: 2,
    spatialShape: 1,
    spatialCentroid: 1,
  });
  assert.equal(result.samples.length, 2);
});

test('rejects duplicate source identifiers across cursor pages', async () => {
  const pages = [
    { after: 'next', results: [{ identifier: 'same' }] },
    { results: [{ identifier: 'same' }] },
  ];
  await assert.rejects(
    probeDataGovSpatialSource({
      retainedIdentifiers: new Set(['same']),
      apiKey: 'personal',
      fetchImpl: async () => jsonResponse(pages.shift()),
    }),
    /repeated identifier same/u,
  );
});

test('rejects empty continuation pages and bounded traversal overflow', async () => {
  await assert.rejects(
    probeDataGovSpatialSource({
      retainedIdentifiers: new Set(),
      apiKey: 'personal',
      fetchImpl: async () => jsonResponse({ after: 'still-more', results: [] }),
    }),
    /empty page with a continuation cursor/u,
  );

  await assert.rejects(
    probeDataGovSpatialSource({
      retainedIdentifiers: new Set(),
      apiKey: 'personal',
      maxPages: 1,
      fetchImpl: async () =>
        jsonResponse({
          after: 'still-more',
          results: [{ identifier: 'x' }],
        }),
    }),
    /reached maxPages=1/u,
  );
});

test('surfaces Data.gov rate limiting with retry context', async () => {
  await assert.rejects(
    probeDataGovSpatialSource({
      retainedIdentifiers: new Set(),
      apiKey: 'personal',
      fetchImpl: async () =>
        jsonResponse({}, { status: 429, headers: { 'retry-after': '3600' } }),
    }),
    /HTTP 429.*retry after 3600/u,
  );
});

test('research spatial probe auto-loads repo-local .env', async () => {
  const packageJson = JSON.parse(
    await readFile(new URL('../../package.json', import.meta.url), 'utf8'),
  );
  assert.equal(
    packageJson.scripts['research:spatial:probe'],
    'node --env-file-if-exists=.env tools/scripts/data-gov-spatial-availability.mjs --expect 500000',
  );
});

test('requires a personal Data.gov API key for full traversal', () => {
  assert.throws(
    () => requirePersonalDataGovApiKey({}),
    /personal CIVICS_FEDERATION_DATA_GOV_API_KEY/u,
  );
  assert.throws(
    () =>
      requirePersonalDataGovApiKey({
        CIVICS_FEDERATION_DATA_GOV_API_KEY: 'DEMO_KEY',
      }),
    /personal CIVICS_FEDERATION_DATA_GOV_API_KEY/u,
  );
  assert.equal(
    requirePersonalDataGovApiKey({
      CIVICS_FEDERATION_DATA_GOV_API_KEY: 'real-key',
    }),
    'real-key',
  );
});

test('loads and normalizes canonical scale evidence from disk', async (t) => {
  const directory = await tempDirectory(t);
  const evidencePath = path.join(directory, 'scale.json');
  await writeFile(
    evidencePath,
    `${JSON.stringify(passingScaleEvidence(), null, 2)}\n`,
    'utf8',
  );

  assert.deepEqual(await loadScaleCertification(evidencePath), {
    kind: 'c2-scale-certification',
    profile: 'FEDERATED_1M',
    capturedAt: '2026-09-02T16:00:00.000Z',
    compositionSha256: 'a'.repeat(64),
    projectionId: 'b'.repeat(64),
    projectionObjectCount: 1_000_181,
    retainedFederatedRecordCount: 1_000_000,
  });
});

test('wraps missing and malformed scale evidence with operator context', async (t) => {
  const directory = await tempDirectory(t);
  await assert.rejects(
    loadScaleCertification(path.join(directory, 'missing.json')),
    /Unable to read valid scale evidence JSON/u,
  );

  const malformed = path.join(directory, 'malformed.json');
  await writeFile(malformed, '{not-json}\n', 'utf8');
  await assert.rejects(
    loadScaleCertification(malformed),
    /Unable to read valid scale evidence JSON/u,
  );
});

test('rejects scale evidence outside the certified C2 contract', () => {
  assert.throws(
    () => normalizeScaleCertification(passingScaleEvidence({ status: 'FAIL' })),
    /must be PASS/u,
  );
  assert.throws(
    () =>
      normalizeScaleCertification(
        passingScaleEvidence({ profile: 'FEDERATED_100K' }),
      ),
    /profile must be FEDERATED_1M/u,
  );
  assert.throws(
    () =>
      normalizeScaleCertification(
        passingScaleEvidence({ compositionSha256: 'not-a-sha' }),
      ),
    /compositionSha256 must be a lowercase SHA-256/u,
  );
});

test('markdown states the source-intersection method and supersedes the URL-string probe', () => {
  const report = {
    capturedAt: '2026-09-02T20:00:00.000Z',
    retainedRecordCount: 500000,
    sourceSpatialRecordCount: 100,
    retainedSpatialRecordCount: 25,
    retainedSpatialPercent: 0.005,
    unmatchedCurrentSourceSpatialRecords: 75,
    pagesFetched: 1,
    matchedMetadataSignals: {
      hasSpatialTrue: 25,
      dcatSpatial: 20,
      spatialShape: 10,
      spatialCentroid: 8,
    },
    samples: [],
    scaleCertification: normalizeScaleCertification(passingScaleEvidence()),
  };
  const markdown = formatMarkdown(report, 500000);
  assert.match(
    markdown,
    /geospatial search intersected with certified retained C2 identifiers/u,
  );
  assert.match(markdown, /harvest_record_raw.*URL/u);
  assert.match(markdown, /not.*byte-for-byte historical C2 metadata/u);
  assert.match(markdown, /\(MATCH\)/u);
});

test('argument parser supports pnpm separator and source traversal controls', () => {
  assert.deepEqual(
    parseArgs([
      '--expect',
      '500000',
      '--',
      '--scale-evidence',
      'tmp/scale.json',
      '--page-size',
      '1000',
      '--max-pages',
      '900',
    ]),
    {
      expectedCount: 500000,
      outputDir: 'browser-evidence-artifacts/spatial-availability',
      scaleEvidencePath: 'tmp/scale.json',
      searchUrl: 'https://api.gsa.gov/technology/datagov/v4/search',
      pageSize: 1000,
      maxPages: 900,
    },
  );
});
