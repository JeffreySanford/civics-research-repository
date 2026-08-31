import assert from 'node:assert/strict';
import test from 'node:test';
import { parseArguments, runResearchScale } from './research-scale-runner.mjs';

function preflight(status) {
  return {
    kind: 'civics-research-scale-preflight',
    readiness: {
      overallStatus: status,
      retainedRecordCount: status === 'READY_TO_MEASURE' ? 1_000_000 : 100_000,
      targetRetainedRecords: 1_000_000,
      remainingRecordCount: status === 'READY_TO_MEASURE' ? 0 : 900_000,
      checks: [],
    },
    markdown: `# ${status}`,
  };
}

function response(body, status = 200) {
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

function progress(phase, processedDocuments, operationId = 'operation-1') {
  return {
    operationId,
    profile: 'FEDERATED_1M',
    phase,
    processedDocuments,
    totalDocuments: 1_000_181,
    percentComplete: phase === 'COMPLETED' ? 100 : 25,
    startedAt: '2026-08-31T16:00:00Z',
    updatedAt: '2026-08-31T16:01:00Z',
    completedAt: phase === 'COMPLETED' ? '2026-08-31T16:02:00Z' : null,
    elapsedMs: 60_000,
    documentsPerSecond: 250,
    message: phase === 'COMPLETED' ? 'Complete.' : 'Harvesting.',
  };
}

test('scale runner CLI exposes one million profile and polling controls', () => {
  const options = parseArguments([
    '--',
    '--profile',
    'FEDERATED_1M',
    '--poll-ms',
    '2500',
    '--output',
    'evidence/scale.json',
  ]);

  assert.equal(options.profile, 'FEDERATED_1M');
  assert.equal(options.pollMs, 2500);
  assert.equal(options.output, 'evidence/scale.json');
  assert.throws(
    () => parseArguments(['--profile', 'FEDERATED_100K']),
    /currently supports FEDERATED_1M only/,
  );
});

test('scale runner refuses mutation when preflight is blocked', async () => {
  let fetchCount = 0;
  await assert.rejects(
    runResearchScale({
      fetchImpl: async () => {
        fetchCount += 1;
        throw new Error('fetch should not be called');
      },
      preflightRunner: async () => preflight('BLOCKED'),
    }),
    /preflight is BLOCKED/,
  );
  assert.equal(fetchCount, 0);
});

test('scale runner no-ops when one million is already ready to measure', async () => {
  let fetchCount = 0;
  const result = await runResearchScale({
    fetchImpl: async () => {
      fetchCount += 1;
      throw new Error('fetch should not be called');
    },
    preflightRunner: async () => preflight('READY_TO_MEASURE'),
    now: () => new Date('2026-08-31T16:00:00Z'),
  });

  assert.equal(fetchCount, 0);
  assert.equal(result.started, false);
  assert.equal(result.preflightAfter.readiness.overallStatus, 'READY_TO_MEASURE');
});

test('scale runner journals one guarded operation through ready to measure', async () => {
  const requests = [];
  const preflights = [preflight('READY_TO_GROW'), preflight('READY_TO_MEASURE')];
  const responses = [
    response(progress('PREPARING', 100_000), 202),
    response(progress('HARVESTING', 250_000)),
    response(progress('COMPLETED', 1_000_181)),
  ];
  const observed = [];
  let nowIndex = 0;
  const times = [
    '2026-08-31T16:00:00Z',
    '2026-08-31T16:00:05Z',
    '2026-08-31T16:05:00Z',
    '2026-08-31T16:05:01Z',
  ];

  const result = await runResearchScale({
    fetchImpl: async (url, init) => {
      requests.push({ url, init });
      const next = responses.shift();
      if (!next) throw new Error('Unexpected request');
      return next;
    },
    preflightRunner: async () => preflights.shift(),
    sleepImpl: async () => {},
    now: () => new Date(times[Math.min(nowIndex++, times.length - 1)]),
    onProgress: (entry) => observed.push(entry),
  });

  assert.equal(requests[0].init.method, 'POST');
  assert.match(requests[0].url, /\/admin\/corpus\/scale\?profile=FEDERATED_1M$/);
  assert.equal(requests[1].url, 'http://localhost:8080/api/admin/reindex/progress');
  assert.equal(result.started, true);
  assert.equal(result.operationId, 'operation-1');
  assert.equal(result.progress.length, 2);
  assert.equal(observed.length, 2);
  assert.equal(result.terminalProgress.phase, 'COMPLETED');
  assert.equal(result.preflightAfter.readiness.overallStatus, 'READY_TO_MEASURE');
});

test('scale runner refuses to mix progress from another operation', async () => {
  const responses = [
    response(progress('PREPARING', 100_000), 202),
    response(progress('HARVESTING', 200_000, 'operation-2')),
  ];

  await assert.rejects(
    runResearchScale({
      fetchImpl: async () => responses.shift(),
      preflightRunner: async () => preflight('READY_TO_GROW'),
      sleepImpl: async () => {},
    }),
    /refusing to mix operation evidence/,
  );
});
