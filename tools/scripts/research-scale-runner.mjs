import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { runResearchScalePreflight } from './research-scale-preflight.mjs';

const DEFAULT_BASE_URL = 'http://localhost:8080/api';
const DEFAULT_PROFILE = 'FEDERATED_1M';
const DEFAULT_POLL_MS = 5_000;
const DEFAULT_OUTPUT =
  'browser-evidence-artifacts/research-performance/federated-1m-scale-run.json';
const TERMINAL_PHASES = new Set(['COMPLETED', 'FAILED']);

function requireProfile(profile) {
  if (profile !== 'FEDERATED_1M') {
    throw new Error('The research scale runner currently supports FEDERATED_1M only.');
  }
  return profile;
}

function requirePositiveInteger(value, label) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`${label} must be a positive integer.`);
  }
  return parsed;
}

function stripMarkdown(preflight) {
  if (!preflight) {
    return null;
  }
  const { markdown: _markdown, ...rest } = preflight;
  return rest;
}

async function fetchJson(fetchImpl, url, init) {
  const response = await fetchImpl(url, init);
  if (!response.ok) {
    let detail = '';
    try {
      const body = await response.text();
      detail = body ? ` ${body}` : '';
    } catch {
      // Preserve the HTTP status when a response body cannot be read.
    }
    throw new Error(`Request failed with HTTP ${response.status}: ${url}${detail}`);
  }
  return response.json();
}

function progressFingerprint(progress) {
  return [
    progress?.operationId ?? '',
    progress?.phase ?? '',
    progress?.processedDocuments ?? '',
    progress?.totalDocuments ?? '',
    progress?.percentComplete ?? '',
    progress?.message ?? '',
  ].join('|');
}

function formatProgress(progress) {
  const processed = Number(progress?.processedDocuments ?? 0).toLocaleString('en-US');
  const total = Number.isFinite(Number(progress?.totalDocuments))
    ? Number(progress.totalDocuments).toLocaleString('en-US')
    : '?';
  const percent = Number.isFinite(Number(progress?.percentComplete))
    ? `${Number(progress.percentComplete)}%`
    : '?';
  const rate = Number.isFinite(Number(progress?.documentsPerSecond))
    ? ` @ ${Number(progress.documentsPerSecond).toFixed(1)} docs/s`
    : '';
  return `[${progress?.phase ?? 'UNKNOWN'}] ${processed} / ${total} (${percent})${rate} — ${progress?.message ?? ''}`;
}

export function parseArguments(argv) {
  const options = {
    baseUrl: DEFAULT_BASE_URL,
    profile: DEFAULT_PROFILE,
    pollMs: DEFAULT_POLL_MS,
    output: DEFAULT_OUTPUT,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const value = argv[index + 1];
    switch (argument) {
      case '--':
        break;
      case '--base-url':
        options.baseUrl = value;
        index += 1;
        break;
      case '--profile':
        options.profile = requireProfile(value);
        index += 1;
        break;
      case '--poll-ms':
        options.pollMs = requirePositiveInteger(value, 'poll-ms');
        index += 1;
        break;
      case '--output':
        options.output = value;
        index += 1;
        break;
      default:
        throw new Error(`Unknown research scale argument: ${argument}`);
    }
  }

  return options;
}

export async function runResearchScale({
  fetchImpl = globalThis.fetch,
  preflightRunner = runResearchScalePreflight,
  sleepImpl = (ms) => new Promise((resolveSleep) => setTimeout(resolveSleep, ms)),
  now = () => new Date(),
  baseUrl = DEFAULT_BASE_URL,
  profile = DEFAULT_PROFILE,
  pollMs = DEFAULT_POLL_MS,
  onProgress = () => {},
} = {}) {
  requireProfile(profile);
  requirePositiveInteger(pollMs, 'poll-ms');
  const root = baseUrl.replace(/\/$/, '');
  const capturedAt = now().toISOString();
  const preflightBefore = await preflightRunner({ fetchImpl, baseUrl: root, profile });
  const beforeStatus = preflightBefore.readiness.overallStatus;

  if (beforeStatus === 'BLOCKED') {
    throw new Error(
      'FEDERATED_1M preflight is BLOCKED. Resolve the reported prerequisites before starting corpus growth.',
    );
  }

  if (beforeStatus === 'READY_TO_MEASURE') {
    return {
      kind: 'civics-research-scale-run',
      capturedAt,
      profile,
      started: false,
      reason: 'Target corpus was already active and parity-valid.',
      preflightBefore: stripMarkdown(preflightBefore),
      progress: [],
      terminalProgress: null,
      preflightAfter: stripMarkdown(preflightBefore),
    };
  }

  if (beforeStatus !== 'READY_TO_GROW') {
    throw new Error(`Unexpected preflight status: ${beforeStatus}`);
  }

  const accepted = await fetchJson(
    fetchImpl,
    `${root}/admin/corpus/scale?profile=${encodeURIComponent(profile)}`,
    { method: 'POST' },
  );
  const operationId = accepted.operationId;
  if (!operationId) {
    throw new Error('Scale operation was accepted without an operationId.');
  }

  const observations = [];
  let lastFingerprint = '';
  let terminalProgress = null;

  while (terminalProgress === null) {
    const progress = await fetchJson(fetchImpl, `${root}/admin/reindex/progress`);
    if (progress.operationId && progress.operationId !== operationId) {
      throw new Error(
        `Scale progress operationId changed from ${operationId} to ${progress.operationId}; refusing to mix operation evidence.`,
      );
    }

    const fingerprint = progressFingerprint(progress);
    if (fingerprint !== lastFingerprint) {
      const observation = { observedAt: now().toISOString(), ...progress };
      observations.push(observation);
      onProgress(observation);
      lastFingerprint = fingerprint;
    }

    if (TERMINAL_PHASES.has(progress.phase)) {
      terminalProgress = progress;
      break;
    }
    await sleepImpl(pollMs);
  }

  if (terminalProgress.phase === 'FAILED') {
    throw new Error(
      `FEDERATED_1M scale operation failed: ${terminalProgress.message ?? 'no failure message'}`,
    );
  }

  const preflightAfter = await preflightRunner({ fetchImpl, baseUrl: root, profile });
  if (preflightAfter.readiness.overallStatus !== 'READY_TO_MEASURE') {
    throw new Error(
      `Scale operation completed but post-run preflight is ${preflightAfter.readiness.overallStatus}; refusing to mark 1M research scale ready.`,
    );
  }

  return {
    kind: 'civics-research-scale-run',
    capturedAt,
    completedAt: now().toISOString(),
    profile,
    started: true,
    operationId,
    accepted,
    preflightBefore: stripMarkdown(preflightBefore),
    progress: observations,
    terminalProgress,
    preflightAfter: stripMarkdown(preflightAfter),
  };
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const result = await runResearchScale({
    baseUrl: options.baseUrl,
    profile: options.profile,
    pollMs: options.pollMs,
    onProgress: (progress) => console.log(formatProgress(progress)),
  });

  const outputPath = resolve(options.output);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  console.log(`Research scale journal written to ${outputPath}`);

  if (!result.started) {
    console.log('FEDERATED_1M was already READY_TO_MEASURE; no scale mutation was started.');
    return;
  }

  console.log('FEDERATED_1M reached READY_TO_MEASURE.');
  console.log('Next evidence step: pnpm research:full:1m');
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
