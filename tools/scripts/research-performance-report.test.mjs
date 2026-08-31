import assert from 'node:assert/strict';
import test from 'node:test';
import {
  parseArguments,
  renderResearchMarkdown,
} from './research-performance-report.mjs';

const PROJECTION_ID = 'a'.repeat(64);

function timing(p50Ms, p95Ms, p99Ms) {
  return {
    sampleCount: 20,
    minMs: p50Ms,
    p50Ms,
    p95Ms,
    p99Ms,
    maxMs: p99Ms,
    meanMs: p50Ms,
  };
}

function scenario(id, solrApi, openSearchApi, solrNative, openSearchNative) {
  return {
    id,
    solr: {
      elapsed: timing(...solrApi),
      engineReported: timing(...solrNative),
    },
    openSearch: {
      elapsed: timing(...openSearchApi),
      engineReported: timing(...openSearchNative),
    },
  };
}

function report(profile = 'FEDERATED_100K') {
  const solrFirst = {
    scenarios: [
      scenario(
        'FULL_TEXT_RELEVANCE',
        [4, 5, 6],
        [9, 12, 12],
        [1, 2, 2],
        [6, 9, 9],
      ),
      scenario(
        'FACETED_SEARCH',
        [5, 6, 14],
        [11, 12, 12],
        [3, 3, 11],
        [8, 9, 10],
      ),
      scenario(
        'FILTERING_SELECTIVE_PROGRAM',
        [3, 3, 3],
        [7, 9, 9],
        [1, 1, 1],
        [5, 6, 7],
      ),
    ],
  };
  const openSearchFirst = {
    scenarios: [
      scenario(
        'FULL_TEXT_RELEVANCE',
        [2, 3, 3],
        [5, 6, 6],
        [1, 1, 1],
        [3, 3, 4],
      ),
      scenario('FACETED_SEARCH', [4, 5, 6], [9, 10, 11], [3, 3, 4], [7, 8, 8]),
      scenario(
        'FILTERING_SELECTIVE_PROGRAM',
        [2, 3, 3],
        [6, 6, 7],
        [1, 1, 1],
        [4, 5, 5],
      ),
    ],
  };

  return {
    capturedAt: '2026-08-31T15:20:00Z',
    paired: {
      profile,
      projection: {
        projectionId: PROJECTION_ID,
        objectCount: profile === 'FEDERATED_1M' ? 1000181 : 100181,
      },
      evidence: {
        retainedFederatedRecordCount:
          profile === 'FEDERATED_1M' ? 1000000 : 100000,
        targetParity: true,
        storageEvidencePresent: true,
      },
      selectedFilter: {
        value: 'Census Program',
        matchingDocuments: 1419,
        selectivityPercent: 1.42,
      },
      hostContext: {
        logicalCpuCount: 24,
        totalMemoryBytes: 68719476736,
        platform: 'win32',
        architecture: 'x64',
      },
      warmupRuns: 3,
      measuredRuns: 20,
      passes: {
        SOLR_FIRST: solrFirst,
        OPENSEARCH_FIRST: openSearchFirst,
      },
      orderRobustness: [
        {
          id: 'FULL_TEXT_RELEVANCE',
          solrLeadsApiP50BothOrders: true,
          solrLeadsApiP95BothOrders: true,
          solrLeadsNativeP50BothOrders: true,
          solrLeadsNativeP95BothOrders: true,
        },
      ],
    },
    aggregationDiagnostic: {
      experiments: {
        unfilteredDirectTerms: {
          baseline: { took: timing(9, 10, 10) },
          candidate: { took: timing(6, 7, 9) },
        },
        selectiveSharedFilterScope: {
          baseline: { took: timing(5, 5, 5) },
          candidate: { took: timing(3, 4, 5) },
        },
      },
    },
  };
}

test('research report CLI supports the proven 100K and planned 1M profiles', () => {
  assert.equal(
    parseArguments(['--profile', 'FEDERATED_100K']).profile,
    'FEDERATED_100K',
  );
  assert.equal(
    parseArguments(['--profile', 'FEDERATED_1M']).profile,
    'FEDERATED_1M',
  );
  assert.throws(
    () => parseArguments(['--profile', 'FULL']),
    /profile must be one of/,
  );
});

test('research report preserves corpus identity, paired timing, and aggregation evidence', () => {
  const markdown = renderResearchMarkdown(report());

  assert.match(markdown, /FEDERATED_100K/);
  assert.match(markdown, new RegExp(PROJECTION_ID));
  assert.match(markdown, /100,181/);
  assert.match(markdown, /SOLR_FIRST/);
  assert.match(markdown, /OPENSEARCH_FIRST/);
  assert.match(markdown, /OpenSearch aggregation-shape research/);
  assert.match(markdown, /33\.33%/);
  assert.match(markdown, /40%/);
  assert.match(markdown, /1M scale plan/);
});

test('1M report uses the same research protocol instead of a separate methodology', () => {
  const value = report('FEDERATED_1M');
  value.aggregationDiagnostic = null;
  const markdown = renderResearchMarkdown(value);

  assert.match(markdown, /FEDERATED_1M/);
  assert.match(markdown, /1,000,181/);
  assert.match(markdown, /1,000,000/);
  assert.match(markdown, /same scenario definitions/);
  assert.match(markdown, /same .*aggregation-shape experiments/);
  assert.match(markdown, /Aggregation-shape diagnostics were not executed/);
});
