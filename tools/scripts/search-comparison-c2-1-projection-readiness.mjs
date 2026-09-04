import { waitForApiReady } from './cursor-traversal-evidence.mjs';
import { C2_1_EXPECTED } from './search-comparison-c2-1-manifest.mjs';
import { C2_1_BASELINE_TREATMENT } from './search-comparison-c2-1-semantic-admission.mjs';

const DEFAULT_BASE_URL = 'http://localhost:8080/api';
const DEFAULT_READY_ATTEMPTS = 240;
const DEFAULT_READY_INTERVAL_MS = 500;

function projectionReady(response) {
  return (
    response?.sameProjection === true &&
    response?.projection?.projectionId === C2_1_EXPECTED.projectionId &&
    Number(response?.projection?.objectCount) ===
      C2_1_EXPECTED.projectionObjectCount &&
    response?.solr?.enabled === true &&
    response?.solr?.reachable === true &&
    Number(response?.solr?.indexedDocumentCount) ===
      C2_1_EXPECTED.projectionObjectCount &&
    response?.openSearch?.enabled === true &&
    response?.openSearch?.reachable === true &&
    Number(response?.openSearch?.indexedDocumentCount) ===
      C2_1_EXPECTED.projectionObjectCount
  );
}

function projectionStatus(response) {
  return [
    `sameProjection=${String(response?.sameProjection ?? 'missing')}`,
    `projection=${response?.projection?.projectionId ?? 'missing'}`,
    `objects=${String(response?.projection?.objectCount ?? 'missing')}`,
    `solr=${String(response?.solr?.indexedDocumentCount ?? 'missing')}`,
    `opensearch=${String(response?.openSearch?.indexedDocumentCount ?? 'missing')}`,
  ].join(', ');
}

export async function waitForC21ProjectionReady({
  fetchImpl = globalThis.fetch,
  baseUrl = DEFAULT_BASE_URL,
  attempts = DEFAULT_READY_ATTEMPTS,
  intervalMs = DEFAULT_READY_INTERVAL_MS,
  sleepImpl = (milliseconds) =>
    new Promise((resolveSleep) => setTimeout(resolveSleep, milliseconds)),
} = {}) {
  const root = baseUrl.replace(/\/$/u, '');
  const endpoint =
    `${root}/search/comparison/run` +
    `?order=SOLR_FIRST&openSearchTreatment=${encodeURIComponent(C2_1_BASELINE_TREATMENT)}`;
  const request = {
    scenario: 'FACETED_SEARCH',
    query: '',
    page: 0,
    pageSize: 1,
  };
  let lastFailure = 'no comparison response yet';

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetchImpl(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(request),
      });
      if (response.ok) {
        const comparison = await response.json();
        if (projectionReady(comparison)) {
          return comparison;
        }
        lastFailure = projectionStatus(comparison);
      } else {
        lastFailure = `HTTP ${response.status}`;
      }
    } catch (error) {
      lastFailure = error instanceof Error ? error.message : String(error);
    }

    if (attempt < attempts) {
      await sleepImpl(intervalMs);
    }
  }

  throw new Error(
    `C2.1 certified projection parity was not ready after ${attempts} attempts (${lastFailure}).`,
  );
}

export async function waitForC21RuntimeReady({
  waitForApi = waitForApiReady,
  waitForProjection = waitForC21ProjectionReady,
  ...options
} = {}) {
  await waitForApi(options);
  return waitForProjection(options);
}
