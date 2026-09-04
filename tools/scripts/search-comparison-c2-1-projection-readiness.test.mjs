import assert from 'node:assert/strict';
import test from 'node:test';
import { C2_1_EXPECTED } from './search-comparison-c2-1-manifest.mjs';
import {
  waitForC21ProjectionReady,
  waitForC21RuntimeReady,
} from './search-comparison-c2-1-projection-readiness.mjs';

function response({ sameProjection = true } = {}) {
  return {
    sameProjection,
    projection: {
      projectionId: C2_1_EXPECTED.projectionId,
      objectCount: C2_1_EXPECTED.projectionObjectCount,
    },
    solr: {
      enabled: true,
      reachable: true,
      indexedDocumentCount: C2_1_EXPECTED.projectionObjectCount,
    },
    openSearch: {
      enabled: true,
      reachable: true,
      indexedDocumentCount: C2_1_EXPECTED.projectionObjectCount,
    },
  };
}

test('projection readiness retries until the certified live projection is rehydrated', async () => {
  const calls = [];
  const sleeps = [];
  const bodies = [];
  const results = [response({ sameProjection: false }), response()];

  const ready = await waitForC21ProjectionReady({
    baseUrl: 'http://example.test/api',
    attempts: 2,
    intervalMs: 7,
    fetchImpl: async (url, init) => {
      calls.push(url);
      bodies.push(JSON.parse(init.body));
      const body = results.shift();
      return {
        ok: true,
        status: 200,
        json: async () => body,
      };
    },
    sleepImpl: async (milliseconds) => {
      sleeps.push(milliseconds);
    },
  });

  assert.equal(ready.sameProjection, true);
  assert.equal(calls.length, 2);
  assert.match(calls[0], /openSearchTreatment=BASELINE_SCOPED_FILTERS/);
  assert.deepEqual(bodies[0], {
    scenario: 'FACETED_SEARCH',
    query: '',
    page: 0,
    pageSize: 1,
  });
  assert.deepEqual(sleeps, [7]);
});

test('projection readiness refuses persistent parity failure', async () => {
  await assert.rejects(
    waitForC21ProjectionReady({
      attempts: 2,
      intervalMs: 0,
      fetchImpl: async () => ({
        ok: true,
        status: 200,
        json: async () => response({ sameProjection: false }),
      }),
      sleepImpl: async () => {},
    }),
    /certified projection parity was not ready/,
  );
});

test('runtime readiness waits for HTTP before certified projection parity', async () => {
  const events = [];
  await waitForC21RuntimeReady({
    baseUrl: 'http://example.test/api',
    waitForApi: async ({ baseUrl }) => {
      events.push(`api:${baseUrl}`);
    },
    waitForProjection: async ({ baseUrl }) => {
      events.push(`projection:${baseUrl}`);
      return response();
    },
  });

  assert.deepEqual(events, [
    'api:http://example.test/api',
    'projection:http://example.test/api',
  ]);
});
