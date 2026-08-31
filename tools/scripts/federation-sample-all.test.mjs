import assert from 'node:assert/strict';
import test from 'node:test';
import './dspace-compose-contract.test.mjs';
import {
  FEDERATION_SAMPLE_SOURCES,
  parseArguments,
  renderMarkdown,
  sampleAllFederatedSources,
} from './federation-sample-all.mjs';

function jsonResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() {
      return body;
    },
    async text() {
      return JSON.stringify(body);
    },
  };
}

test('all-source sampler preserves existing sources and freshly samples only empty authorities', async () => {
  const retained = new Map([
    ['DATA_GOV', 100000],
    ['DOE_OSTI', 0],
    ['NASA_CMR', 0],
    ['PUBMED', 0],
    ['OPENALEX', 0],
  ]);
  const posts = [];
  const fetchImpl = async (url, init) => {
    const parsed = new URL(url);
    const sourceSystem = parsed.searchParams.get('sourceSystem');
    if (!init) {
      return jsonResponse({
        sourceSystem,
        retainedRecordCount: retained.get(sourceSystem),
        resumableRun: null,
        latestRun: null,
      });
    }
    const request = JSON.parse(init.body);
    posts.push({ path: parsed.pathname, request });
    retained.set(request.sourceSystem, retained.get(request.sourceSystem) + 25);
    return jsonResponse({
      runId: `run-${request.sourceSystem}`,
      sourceSystem: request.sourceSystem,
      adapterVersion: `adapter-${request.sourceSystem}`,
      status: 'PAUSED',
      pageSize: request.pageSize,
      pageCount: 1,
      acceptedCount: 25,
      rejectedCount: 0,
      skippedCount: 0,
      projectionRefreshRequired: true,
    });
  };

  const report = await sampleAllFederatedSources({
    fetchImpl,
    baseUrl: 'http://repository.test/api',
    pageSize: 25,
    now: () => new Date('2026-08-31T17:00:00Z'),
  });

  assert.equal(report.successful, true);
  assert.equal(report.sources.length, FEDERATION_SAMPLE_SOURCES.length);
  assert.equal(report.sources[0].sourceSystem, 'DATA_GOV');
  assert.equal(report.sources[0].status, 'EXISTING');
  assert.equal(report.sources[0].afterRetainedRecordCount, 100000);
  assert.equal(posts.length, 4);
  assert.deepEqual(
    posts.map(({ request }) => request.sourceSystem),
    ['DOE_OSTI', 'NASA_CMR', 'PUBMED', 'OPENALEX'],
  );
  assert.ok(
    posts.every(
      ({ path, request }) =>
        path.endsWith('/admin/federation/harvest/restart') &&
        request.pageSize === 25 &&
        request.maxPages === 1,
    ),
  );
});

test('sampler continues across a source failure and reports partial evidence', async () => {
  const retained = new Map(
    FEDERATION_SAMPLE_SOURCES.map((source) => [source, 0]),
  );
  const fetchImpl = async (url, init) => {
    const parsed = new URL(url);
    const sourceSystem = parsed.searchParams.get('sourceSystem');
    if (!init) {
      return jsonResponse({
        sourceSystem,
        retainedRecordCount: retained.get(sourceSystem),
        resumableRun: null,
        latestRun: null,
      });
    }
    const request = JSON.parse(init.body);
    if (request.sourceSystem === 'PUBMED') {
      return jsonResponse({ error: 'rate limited' }, 502);
    }
    retained.set(request.sourceSystem, 10);
    return jsonResponse({
      runId: `run-${request.sourceSystem}`,
      sourceSystem: request.sourceSystem,
      adapterVersion: `adapter-${request.sourceSystem}`,
      status: 'PAUSED',
      rejectedCount: 0,
      skippedCount: 0,
    });
  };

  const report = await sampleAllFederatedSources({
    fetchImpl,
    baseUrl: 'http://repository.test/api',
    pageSize: 10,
  });

  assert.equal(report.successful, false);
  const pubmed = report.sources.find(
    (source) => source.sourceSystem === 'PUBMED',
  );
  assert.equal(pubmed.status, 'FAILED');
  assert.match(pubmed.detail, /HTTP 502/);
  assert.equal(
    report.sources.find((source) => source.sourceSystem === 'OPENALEX').status,
    'SAMPLED',
  );

  const markdown = renderMarkdown(report);
  assert.match(markdown, /## Sampling issues/);
  assert.match(markdown, /\*\*PUBMED \(FAILED\):\*\*/);
  assert.match(markdown, /HTTP 502/);
  assert.match(markdown, /rate limited/);
});

test('sampler refuses to call an empty successful request source representation', async () => {
  const retained = new Map(
    FEDERATION_SAMPLE_SOURCES.map((source) => [source, source === 'NASA_CMR' ? 0 : 1]),
  );
  const fetchImpl = async (url, init) => {
    const parsed = new URL(url);
    const sourceSystem = parsed.searchParams.get('sourceSystem');
    if (!init) {
      return jsonResponse({
        sourceSystem,
        retainedRecordCount: retained.get(sourceSystem),
        resumableRun: null,
        latestRun: null,
      });
    }
    const request = JSON.parse(init.body);
    assert.equal(request.sourceSystem, 'NASA_CMR');
    return jsonResponse({
      runId: 'run-nasa-empty',
      sourceSystem: 'NASA_CMR',
      adapterVersion: 'nasa-cmr-collections-v2',
      status: 'PAUSED',
      acceptedCount: 0,
      rejectedCount: 25,
      skippedCount: 0,
    });
  };

  const report = await sampleAllFederatedSources({
    fetchImpl,
    baseUrl: 'http://repository.test/api',
    pageSize: 25,
  });

  assert.equal(report.successful, false);
  const nasa = report.sources.find(
    (source) => source.sourceSystem === 'NASA_CMR',
  );
  assert.equal(nasa.status, 'EMPTY');
  assert.equal(nasa.afterRetainedRecordCount, 0);
  assert.equal(nasa.rejectedThisSample, 25);
  assert.match(nasa.detail, /source representation is not established/);

  const markdown = renderMarkdown(report);
  assert.match(markdown, /Overall: \*\*PARTIAL\*\*/);
  assert.match(markdown, /NASA_CMR \| EMPTY/);
  assert.match(markdown, /\*\*NASA_CMR \(EMPTY\):\*\*/);
  assert.match(markdown, /rejected=25/);
  assert.match(markdown, /HTTP success alone is not sufficient/);
});

test('sample CLI and report rendering expose bounded non-projecting semantics', () => {
  const options = parseArguments([
    '--',
    '--page-size',
    '50',
    '--base-url',
    'http://localhost:9999/api/',
    '--output',
    'tmp/sample.json',
  ]);
  assert.equal(options.pageSize, 50);
  assert.equal(options.baseUrl, 'http://localhost:9999/api');
  assert.equal(options.outputPath, 'tmp/sample.json');

  const markdown = renderMarkdown({
    capturedAt: '2026-08-31T17:00:00Z',
    successful: true,
    methodology: 'Bounded sample.',
    sources: [
      {
        sourceSystem: 'DATA_GOV',
        status: 'EXISTING',
        beforeRetainedRecordCount: 100000,
        afterRetainedRecordCount: 100000,
        acceptedThisSample: 0,
        rejectedThisSample: 0,
      },
    ],
  });
  assert.match(
    markdown,
    /does \*\*not\*\* activate a mixed-source search projection/,
  );
  assert.match(markdown, /Publisher binaries are not mirrored/);
});
