import assert from 'node:assert/strict';
import test from 'node:test';

import {
  classifyCursorTraversal,
  traverseCursor,
} from './cursor-traversal-evidence.mjs';

const PROJECTION_ID = 'a'.repeat(64);

function response(json) {
  return {
    ok: true,
    status: 200,
    async json() {
      return json;
    },
  };
}

test('traverseCursor visits every logical page and hashes ordered IDs', async () => {
  const calls = [];
  const fetchImpl = async (url) => {
    const parsed = new URL(url);
    calls.push(parsed);
    const cursor = parsed.searchParams.get('cursor');
    if (!cursor) {
      return response({
        search: {
          resultSource: 'REPOSITORY',
          page: 0,
          pageSize: 2,
          totalResults: 4,
          results: [{ id: 'alpha' }, { id: 'beta' }],
        },
        nextCursor: 'cursor-1',
      });
    }

    assert.equal(cursor, 'cursor-1');
    return response({
      search: {
        resultSource: 'REPOSITORY',
        page: 1,
        pageSize: 2,
        totalResults: 4,
        results: [{ id: 'gamma' }, { id: 'delta' }],
      },
      nextCursor: null,
    });
  };

  const result = await traverseCursor({
    fetchImpl,
    baseUrl: 'http://example.test/api',
    pageSize: 2,
  });

  assert.equal(calls.length, 2);
  assert.equal(calls[0].searchParams.get('pageSize'), '2');
  assert.equal(calls[0].searchParams.has('cursor'), false);
  assert.equal(calls[1].searchParams.get('cursor'), 'cursor-1');
  assert.equal(result.totalResults, 4);
  assert.equal(result.returnedCount, 4);
  assert.equal(result.uniqueCount, 4);
  assert.equal(result.duplicateCount, 0);
  assert.match(result.orderedIdSha256, /^[0-9a-f]{64}$/u);
});

test('traverseCursor records duplicate IDs instead of treating count parity as completeness', async () => {
  const fetchImpl = async (url) => {
    const cursor = new URL(url).searchParams.get('cursor');
    return response(
      cursor
        ? {
            search: {
              resultSource: 'REPOSITORY',
              page: 1,
              pageSize: 2,
              totalResults: 4,
              results: [{ id: 'beta' }, { id: 'delta' }],
            },
            nextCursor: null,
          }
        : {
            search: {
              resultSource: 'REPOSITORY',
              page: 0,
              pageSize: 2,
              totalResults: 4,
              results: [{ id: 'alpha' }, { id: 'beta' }],
            },
            nextCursor: 'cursor-1',
          },
    );
  };

  const result = await traverseCursor({
    fetchImpl,
    baseUrl: 'http://example.test/api',
    pageSize: 2,
  });

  assert.equal(result.returnedCount, 4);
  assert.equal(result.uniqueCount, 3);
  assert.equal(result.duplicateCount, 1);
  assert.deepEqual(result.duplicateIds, ['beta']);
});

test('classifyCursorTraversal requires complete unique deterministic passes and a stable projection', () => {
  const pass = {
    pageCount: 2,
    pageSize: 2,
    totalResults: 4,
    returnedCount: 4,
    uniqueCount: 4,
    duplicateCount: 0,
    duplicateIds: [],
    orderedIdSha256: 'b'.repeat(64),
    resultSource: 'REPOSITORY',
  };
  const projection = {
    valid: true,
    activeProfile: 'FEDERATED_1M',
    projectionId: PROJECTION_ID,
    projectionObjectCount: 4,
    violations: [],
  };

  const result = classifyCursorTraversal({
    profile: 'FEDERATED_1M',
    startProjection: projection,
    endProjection: projection,
    passes: [pass, { ...pass }],
  });

  assert.equal(result.status, 'PASS');
  assert.equal(
    result.checks.find((entry) => entry.id === 'deterministic-order')?.status,
    'PASS',
  );
});

test('classifyCursorTraversal fails duplicate and projection-drift evidence', () => {
  const pass = {
    pageCount: 2,
    pageSize: 2,
    totalResults: 4,
    returnedCount: 4,
    uniqueCount: 3,
    duplicateCount: 1,
    duplicateIds: ['beta'],
    orderedIdSha256: 'b'.repeat(64),
    resultSource: 'REPOSITORY',
  };
  const startProjection = {
    valid: true,
    activeProfile: 'FEDERATED_1M',
    projectionId: PROJECTION_ID,
    projectionObjectCount: 4,
    violations: [],
  };
  const endProjection = {
    ...startProjection,
    projectionId: 'c'.repeat(64),
  };

  const result = classifyCursorTraversal({
    profile: 'FEDERATED_1M',
    startProjection,
    endProjection,
    passes: [pass, { ...pass, orderedIdSha256: 'd'.repeat(64) }],
  });

  assert.equal(result.status, 'FAIL');
  assert.equal(
    result.checks.find((entry) => entry.id === 'projection-stable-through-run')
      ?.status,
    'FAIL',
  );
  assert.equal(
    result.checks.find((entry) => entry.id === 'pass-1-unique-ids')?.status,
    'FAIL',
  );
  assert.equal(
    result.checks.find((entry) => entry.id === 'deterministic-order')?.status,
    'FAIL',
  );
});
