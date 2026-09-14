import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const baseUrl =
  process.env.CIVICS_EVIDENCE_API_URL ?? 'http://localhost:8080/api';
const output = resolve(
  process.env.CIVICS_EVIDENCE_OUTPUT ??
    'browser-evidence-artifacts/dspace-provenance-idempotence.json',
);
const readbackOutput = resolve(
  process.env.CIVICS_EVIDENCE_READBACK_OUTPUT ??
    'browser-evidence-artifacts/dspace-provenance-readback.json',
);
const researchObjectId = 'tiger-line-north-dakota-2025';

async function requestJson(path, init = {}) {
  const response = await fetch(`${baseUrl}${path}`, init);
  const text = await response.text();
  if (!response.ok) {
    throw new Error(
      `${init.method ?? 'GET'} ${path} failed with HTTP ${response.status}: ${text}`,
    );
  }
  return text ? JSON.parse(text) : null;
}

async function sync(mode) {
  return requestJson('/admin/sync', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ mode, source: 'TIGER_LINE' }),
  });
}

function actionTypes(job) {
  return (job.actions ?? []).map((action) => action.actionType);
}

function requireCondition(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function writeEvidence(path, evidence) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
}

const apply = await sync('APPLY');
requireCondition(
  apply.status === 'APPLIED',
  `Expected APPLY status APPLIED; received ${apply.status}`,
);

const diff = await sync('DIFF');
const diffActions = actionTypes(diff);
requireCondition(
  diff.status === 'DIFF_COMPLETE',
  `Expected DIFF status DIFF_COMPLETE; received ${diff.status}`,
);
requireCondition(
  diffActions.includes('SKIP_ITEM'),
  `Expected replay-safe SKIP_ITEM after APPLY; received ${diffActions.join(', ')}`,
);
requireCondition(
  !diffActions.includes('CREATE_ITEM') && !diffActions.includes('UPDATE_ITEM'),
  `APPLY did not settle: DIFF still contains create/update actions (${diffActions.join(', ')})`,
);

const token = Buffer.from(researchObjectId, 'utf8').toString('base64url');
const history = await requestJson(`/research/${token}/versions`);
const current =
  history.versions?.find((version) => version.current) ?? history.versions?.[0];

// Persist the actual read-back before contract assertions run. If an assertion fails, the CI
// artifact still contains the state that caused the failure instead of only container logs.
const readbackEvidence = {
  evidenceVersion: 1,
  source: 'TIGER_LINE',
  researchObjectId,
  phase: 'READBACK_OBSERVED',
  replayDiff: {
    status: diff.status,
    actionTypes: diffActions,
    settled: true,
  },
  history,
  selectedCurrent: current ?? null,
};
await writeEvidence(readbackOutput, readbackEvidence);
console.log(JSON.stringify(readbackEvidence, null, 2));

requireCondition(
  history.status === 'OBSERVED_CURRENT_ONLY',
  `Phase B must not claim multi-version history; received ${history.status}`,
);
requireCondition(
  current,
  'Expected one observed current version after DSpace APPLY.',
);
requireCondition(
  current.versionLabel === 'TIGER2025',
  `Expected DSpace-backed source version TIGER2025; received ${current.versionLabel ?? 'absent'}`,
);
requireCondition(
  current.sourceSha256 == null,
  'TIGER source probe does not compute SHA-256; live evidence must leave it absent.',
);
requireCondition(
  current.capturedAt == null,
  'TIGER source probe has no retained capture timestamp; live evidence must leave it absent.',
);

const evidence = {
  evidenceVersion: 1,
  source: 'TIGER_LINE',
  researchObjectId,
  apply: {
    status: apply.status,
    actionTypes: actionTypes(apply),
  },
  replayDiff: {
    status: diff.status,
    actionTypes: diffActions,
    settled: true,
  },
  observedVersion: {
    historyStatus: history.status,
    id: current.id,
    versionLabel: current.versionLabel,
    versionDate: current.versionDate ?? null,
    releasedOn: current.releasedOn ?? null,
    sourceUrl: current.sourceUrl ?? null,
    sourceSha256: current.sourceSha256 ?? null,
    capturedAt: current.capturedAt ?? null,
    isVersionOf: current.isVersionOf ?? null,
    supersedes: current.supersedes ?? null,
  },
};

await writeEvidence(output, evidence);
console.log(JSON.stringify(evidence, null, 2));
