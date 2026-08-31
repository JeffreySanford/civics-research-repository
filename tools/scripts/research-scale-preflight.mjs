import { mkdir, statfs, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const DEFAULT_BASE_URL = 'http://localhost:8080/api';
const DEFAULT_PROFILE = 'FEDERATED_1M';
const DEFAULT_OUTPUT =
  'browser-evidence-artifacts/research-performance/federated-1m-preflight.json';
const TARGET_RECORDS = Object.freeze({
  FEDERATED_100K: 100000,
  FEDERATED_1M: 1000000,
});
const STORAGE_FIELDS = Object.freeze([
  'applicationPostgresBytes',
  'dspaceStoredBytes',
  'solrIndexBytes',
  'openSearchIndexBytes',
]);
const SAFETY_MARGIN = 1.25;

function requireProfile(profile) {
  if (!(profile in TARGET_RECORDS)) {
    throw new Error(
      `profile must be one of ${Object.keys(TARGET_RECORDS).join(', ')}.`,
    );
  }
  return profile;
}

function asNumber(value) {
  return Number.isFinite(Number(value)) ? Number(value) : null;
}

function bytes(value) {
  return Math.max(0, Math.round(asNumber(value) ?? 0));
}

function formatBytes(value) {
  const amount = bytes(value);
  const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB'];
  let scaled = amount;
  let unit = 0;
  while (scaled >= 1024 && unit < units.length - 1) {
    scaled /= 1024;
    unit += 1;
  }
  const digits = unit === 0 || scaled >= 100 ? 0 : scaled >= 10 ? 1 : 2;
  return `${scaled.toFixed(digits)} ${units[unit]}`;
}

function measurementForProfile(overview, profile) {
  const fromProfile = overview?.profiles?.find((entry) => entry.profile === profile)
    ?.latestMeasurement;
  if (fromProfile) {
    return fromProfile;
  }
  return (overview?.history ?? []).find((entry) => entry.profile === profile) ?? null;
}

function componentEstimate(lower, upper, field, targetRetained) {
  const upperBytes = bytes(upper?.[field]);
  const upperRetained = asNumber(upper?.retainedFederatedCount) ?? 0;
  if (field === 'dspaceStoredBytes') {
    return {
      bytes: upperBytes,
      method: 'fixed-authority-footprint',
      bytesPerAdditionalRecord: 0,
    };
  }

  const lowerBytes = bytes(lower?.[field]);
  const lowerRetained = asNumber(lower?.retainedFederatedCount) ?? 0;
  if (lower && upperRetained > lowerRetained) {
    const slope = (upperBytes - lowerBytes) / (upperRetained - lowerRetained);
    return {
      bytes: Math.max(
        upperBytes,
        Math.round(upperBytes + slope * (targetRetained - upperRetained)),
      ),
      method: '10k-to-100k-linear-slope',
      bytesPerAdditionalRecord: slope,
    };
  }

  if (upperRetained > 0) {
    const slope = upperBytes / upperRetained;
    return {
      bytes: Math.max(upperBytes, Math.round(slope * targetRetained)),
      method: 'single-point-linear-fallback',
      bytesPerAdditionalRecord: slope,
    };
  }

  return {
    bytes: upperBytes,
    method: 'insufficient-baseline',
    bytesPerAdditionalRecord: null,
  };
}

export function estimateStorageAtTarget({
  lowerMeasurement,
  upperMeasurement,
  targetRetained,
}) {
  if (!upperMeasurement) {
    return null;
  }
  const components = Object.fromEntries(
    STORAGE_FIELDS.map((field) => [
      field,
      componentEstimate(
        lowerMeasurement,
        upperMeasurement,
        field,
        targetRetained,
      ),
    ]),
  );
  const estimatedSteadyBytes = STORAGE_FIELDS.reduce(
    (sum, field) => sum + components[field].bytes,
    0,
  );
  const currentMeasuredBytes = bytes(
    upperMeasurement.totalMeasuredLocalBytes ??
      STORAGE_FIELDS.reduce(
        (sum, field) => sum + bytes(upperMeasurement[field]),
        0,
      ),
  );
  const currentDerivedIndexBytes =
    bytes(upperMeasurement.solrIndexBytes) +
    bytes(upperMeasurement.openSearchIndexBytes);
  const estimatedPeakBytes = estimatedSteadyBytes + currentDerivedIndexBytes;
  const minimumAdditionalFreeBytes = Math.max(
    0,
    estimatedPeakBytes - currentMeasuredBytes,
  );
  const recommendedFreeBytes = Math.ceil(
    minimumAdditionalFreeBytes * SAFETY_MARGIN,
  );

  return {
    targetRetained,
    lowerBaselineProfile: lowerMeasurement?.profile ?? null,
    upperBaselineProfile: upperMeasurement.profile,
    components,
    currentMeasuredBytes,
    currentDerivedIndexBytes,
    estimatedSteadyBytes,
    estimatedPeakBytes,
    minimumAdditionalFreeBytes,
    safetyMarginPercent: 25,
    recommendedFreeBytes,
  };
}

function check(id, status, detail) {
  return { id, status, detail };
}

export function classifyPreflight({
  profile,
  storageEstimate,
  freeDiskBytes,
  baselineEvidence,
  targetEvidence,
  harvestStatus,
}) {
  const target = TARGET_RECORDS[profile];
  const retained = asNumber(harvestStatus?.retainedRecordCount) ?? 0;
  const resumable = harvestStatus?.resumableRun ?? null;
  const latest = harvestStatus?.latestRun ?? null;
  const diskKnown = Number.isFinite(freeDiskBytes);
  const diskReady =
    storageEstimate &&
    diskKnown &&
    freeDiskBytes >= storageEstimate.recommendedFreeBytes;
  const targetEvidenceReady =
    targetEvidence?.valid === true &&
    targetEvidence?.activeProfile === profile &&
    targetEvidence?.targetParity === true &&
    (asNumber(targetEvidence?.retainedFederatedRecordCount) ?? 0) >= target;
  const baselineEvidenceReady =
    targetEvidenceReady ||
    (baselineEvidence?.valid === true && baselineEvidence?.targetParity === true);

  const checks = [
    check(
      'baseline-evidence',
      baselineEvidenceReady ? 'READY' : 'BLOCKED',
      targetEvidenceReady && baselineEvidence?.valid !== true
        ? `${profile} target evidence is valid and supersedes the active-profile requirement on the historical 100K evidence endpoint.`
        : baselineEvidence?.valid
          ? `${baselineEvidence.activeProfile ?? 'unknown'} has valid parity evidence.`
          : 'The proven baseline scale evidence is not valid.',
    ),
    check(
      'storage-baseline',
      storageEstimate ? 'READY' : 'BLOCKED',
      storageEstimate
        ? `Storage estimate uses ${storageEstimate.lowerBaselineProfile ?? 'single-point'} and ${storageEstimate.upperBaselineProfile}.`
        : 'A measured upper storage baseline is required.',
    ),
    check(
      'harvest-resume',
      resumable || latest ? 'READY' : 'BLOCKED',
      resumable
        ? `Durable ${resumable.status ?? 'unknown'} run ${resumable.runId ?? ''} can resume.`
        : latest
          ? `Latest durable run ${latest.runId ?? ''} is available as checkpoint evidence.`
          : 'No durable Data.gov harvest run is visible.',
    ),
    check(
      'disk-headroom',
      !diskKnown
        ? 'UNKNOWN'
        : diskReady
          ? 'READY'
          : 'BLOCKED',
      !diskKnown
        ? 'Local free disk could not be measured.'
        : storageEstimate
          ? `${formatBytes(freeDiskBytes)} free; ${formatBytes(storageEstimate.recommendedFreeBytes)} recommended before growth/projection.`
          : `${formatBytes(freeDiskBytes)} free; storage requirement unavailable.`,
    ),
    check(
      'retained-target',
      retained >= target ? 'READY' : 'PENDING',
      `${retained.toLocaleString('en-US')} / ${target.toLocaleString('en-US')} retained records.`,
    ),
    check(
      'active-target-evidence',
      targetEvidenceReady ? 'READY' : 'PENDING',
      targetEvidenceReady
        ? `${profile} is active with valid target parity.`
        : `${profile} is not yet active with valid target parity.`,
    ),
  ];

  const blocked = checks.some((entry) => entry.status === 'BLOCKED');
  const overallStatus = blocked
    ? 'BLOCKED'
    : targetEvidenceReady
      ? 'READY_TO_MEASURE'
      : 'READY_TO_GROW';

  return {
    profile,
    targetRetainedRecords: target,
    retainedRecordCount: retained,
    remainingRecordCount: Math.max(0, target - retained),
    overallStatus,
    checks,
  };
}

async function fetchJson(fetchImpl, url) {
  const response = await fetchImpl(url);
  if (!response.ok) {
    throw new Error(`Request failed with HTTP ${response.status}: ${url}`);
  }
  return response.json();
}

async function localFreeDiskBytes(path = resolve('.')) {
  try {
    const stats = await statfs(path);
    const blocks = asNumber(stats.bavail ?? stats.bfree);
    const blockSize = asNumber(stats.bsize);
    if (blocks === null || blockSize === null) {
      return null;
    }
    return blocks * blockSize;
  } catch {
    return null;
  }
}

function renderChecks(checks) {
  return checks
    .map((entry) => `| ${entry.id} | ${entry.status} | ${entry.detail} |`)
    .join('\n');
}

export function renderPreflightMarkdown(result) {
  const estimate = result.storageEstimate;
  const componentRows = estimate
    ? STORAGE_FIELDS.map((field) => {
        const value = estimate.components[field];
        return `| ${field} | ${formatBytes(value.bytes)} | ${value.method} | ${value.bytesPerAdditionalRecord === null ? 'n/a' : value.bytesPerAdditionalRecord.toFixed(2)} |`;
      }).join('\n')
    : '| unavailable | n/a | insufficient baseline | n/a |';

  return `# Research Scale Preflight — ${result.profile}

Captured: ${result.capturedAt}

## Status

- Overall: **${result.readiness.overallStatus}**
- Retained: **${result.readiness.retainedRecordCount.toLocaleString('en-US')} / ${result.readiness.targetRetainedRecords.toLocaleString('en-US')}**
- Remaining: **${result.readiness.remainingRecordCount.toLocaleString('en-US')}**
- Local free disk: **${result.freeDiskBytes === null ? 'unknown' : formatBytes(result.freeDiskBytes)}**

| Check | Status | Detail |
| --- | --- | --- |
${renderChecks(result.readiness.checks)}

## Storage projection

This is a research estimate, not a production capacity guarantee. PostgreSQL, Solr, and OpenSearch are projected from measured per-record growth. DSpace is held at the measured upper-baseline footprint because federated records are metadata references rather than mirrored binaries.

| Component | Estimated 1M footprint | Method | Bytes / additional retained record |
| --- | ---: | --- | ---: |
${componentRows}

${estimate ? `- Current measured local footprint: **${formatBytes(estimate.currentMeasuredBytes)}**
- Estimated steady 1M footprint: **${formatBytes(estimate.estimatedSteadyBytes)}**
- Conservative peak estimate including current derived indexes during projection: **${formatBytes(estimate.estimatedPeakBytes)}**
- Minimum additional free space from current state: **${formatBytes(estimate.minimumAdditionalFreeBytes)}**
- Recommended free space with ${estimate.safetyMarginPercent}% research margin: **${formatBytes(estimate.recommendedFreeBytes)}**` : '- Storage estimate unavailable.'}

## Next action

${result.readiness.overallStatus === 'BLOCKED' ? 'Resolve BLOCKED prerequisites before growing the corpus.' : result.readiness.overallStatus === 'READY_TO_MEASURE' ? 'The target corpus is active and parity-valid; the full 1M research report may run.' : 'Infrastructure prerequisites are ready for controlled corpus growth. Harvest/resume toward the target, then snapshot, project, capture storage evidence, and rerun this preflight before measurement.'}

The preflight never mutates corpus state and never substitutes a smaller corpus for the requested profile.
`;
}

export async function runResearchScalePreflight({
  fetchImpl = globalThis.fetch,
  baseUrl = DEFAULT_BASE_URL,
  profile = DEFAULT_PROFILE,
  diskProvider = localFreeDiskBytes,
  now = () => new Date(),
} = {}) {
  requireProfile(profile);
  const root = baseUrl.replace(/\/$/, '');
  const [overview, baselineEvidence, targetEvidence, harvestStatus, freeDiskBytes] =
    await Promise.all([
      fetchJson(fetchImpl, `${root}/admin/corpus/storage`),
      fetchJson(
        fetchImpl,
        `${root}/admin/corpus/scale/evidence?profile=FEDERATED_100K`,
      ),
      fetchJson(
        fetchImpl,
        `${root}/admin/corpus/scale/evidence?profile=${encodeURIComponent(profile)}`,
      ),
      fetchJson(
        fetchImpl,
        `${root}/admin/federation/harvest/status?sourceSystem=DATA_GOV`,
      ),
      diskProvider(),
    ]);

  const lowerMeasurement = measurementForProfile(overview, 'FEDERATED_10K');
  const upperMeasurement = measurementForProfile(overview, 'FEDERATED_100K');
  const storageEstimate = estimateStorageAtTarget({
    lowerMeasurement,
    upperMeasurement,
    targetRetained: TARGET_RECORDS[profile],
  });
  const readiness = classifyPreflight({
    profile,
    storageEstimate,
    freeDiskBytes,
    baselineEvidence,
    targetEvidence,
    harvestStatus,
  });
  const result = {
    kind: 'civics-research-scale-preflight',
    capturedAt: now().toISOString(),
    profile,
    freeDiskBytes,
    storageEstimate,
    readiness,
    evidence: {
      baseline: baselineEvidence,
      target: targetEvidence,
      harvest: harvestStatus,
    },
  };
  return { ...result, markdown: renderPreflightMarkdown(result) };
}

export function parseArguments(argv) {
  const options = {
    baseUrl: DEFAULT_BASE_URL,
    profile: DEFAULT_PROFILE,
    output: DEFAULT_OUTPUT,
    requireReadyToMeasure: false,
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
      case '--output':
        options.output = value;
        index += 1;
        break;
      case '--require-ready-to-measure':
        options.requireReadyToMeasure = true;
        break;
      default:
        throw new Error(`Unknown research preflight argument: ${argument}`);
    }
  }
  return options;
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const result = await runResearchScalePreflight({
    baseUrl: options.baseUrl,
    profile: options.profile,
  });
  const outputPath = resolve(options.output);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(
    outputPath,
    `${JSON.stringify({ ...result, markdown: undefined }, null, 2)}\n`,
    'utf8',
  );
  const markdownPath = outputPath.replace(/\.json$/i, '.md');
  await writeFile(markdownPath, result.markdown, 'utf8');
  console.log(`Research preflight JSON written to ${outputPath}`);
  console.log(`Research preflight Markdown written to ${markdownPath}`);
  console.log(result.markdown);

  if (
    options.requireReadyToMeasure &&
    result.readiness.overallStatus !== 'READY_TO_MEASURE'
  ) {
    process.exitCode = 2;
  }
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
