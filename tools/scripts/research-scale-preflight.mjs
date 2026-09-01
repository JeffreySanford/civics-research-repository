import { mkdir, statfs, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const DEFAULT_BASE_URL = 'http://localhost:8080/api';
const DEFAULT_PROFILE = 'FEDERATED_1M';
const DEFAULT_OUTPUT =
  'browser-evidence-artifacts/research-performance/federated-1m-preflight.json';

const PROFILE_RECIPES = Object.freeze({
  FEDERATED_100K: Object.freeze({
    target: 100000,
    composite: false,
    sources: Object.freeze([
      Object.freeze({ sourceSystem: 'DATA_GOV', requestedRecordCount: 100000 }),
    ]),
  }),
  FEDERATED_1M: Object.freeze({
    target: 1000000,
    composite: true,
    sources: Object.freeze([
      Object.freeze({ sourceSystem: 'DATA_GOV', requestedRecordCount: 500000 }),
      Object.freeze({ sourceSystem: 'DOE_OSTI', requestedRecordCount: 500000 }),
    ]),
  }),
});

const STORAGE_FIELDS = Object.freeze([
  'applicationPostgresBytes',
  'dspaceStoredBytes',
  'solrIndexBytes',
  'openSearchIndexBytes',
]);
const SAFETY_MARGIN = 1.25;

function requireProfile(profile) {
  if (!(profile in PROFILE_RECIPES)) {
    throw new Error(
      `profile must be one of ${Object.keys(PROFILE_RECIPES).join(', ')}.`,
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
  const fromProfile = overview?.profiles?.find(
    (entry) => entry.profile === profile,
  )?.latestMeasurement;
  if (fromProfile) {
    return fromProfile;
  }
  return (
    (overview?.history ?? []).find((entry) => entry.profile === profile) ?? null
  );
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

function legacyClassify({
  profile,
  storageEstimate,
  freeDiskBytes,
  baselineEvidence,
  targetEvidence,
  harvestStatus,
}) {
  const target = PROFILE_RECIPES[profile].target;
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
    (baselineEvidence?.valid === true &&
      baselineEvidence?.targetParity === true);

  const checks = [
    check(
      'baseline-evidence',
      baselineEvidenceReady ? 'READY' : 'BLOCKED',
      targetEvidenceReady && baselineEvidence?.valid !== true
        ? `${profile} target evidence is valid and supersedes the historical baseline check.`
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
      !diskKnown ? 'UNKNOWN' : diskReady ? 'READY' : 'BLOCKED',
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
  return {
    profile,
    targetRetainedRecords: target,
    retainedRecordCount: retained,
    remainingRecordCount: Math.max(0, target - retained),
    overallStatus: blocked
      ? 'BLOCKED'
      : targetEvidenceReady
        ? 'READY_TO_MEASURE'
        : 'READY_TO_GROW',
    checks,
  };
}

function sourceProgress(recipe, sourceStatuses) {
  return recipe.sources.map((source) => {
    const status = sourceStatuses?.[source.sourceSystem] ?? null;
    const retained = asNumber(status?.retainedRecordCount) ?? 0;
    const credited = Math.min(retained, source.requestedRecordCount);
    return {
      ...source,
      retainedRecordCount: retained,
      creditedRecordCount: credited,
      remainingRecordCount: Math.max(0, source.requestedRecordCount - retained),
      quotaReady: retained >= source.requestedRecordCount,
      resumableRun: status?.resumableRun ?? null,
      latestRun: status?.latestRun ?? null,
    };
  });
}

function exactComposition(profile, recipe, compositions) {
  return (compositions ?? []).find((composition) => {
    if (
      composition?.corpusProfile !== profile ||
      asNumber(composition?.federatedRecordCount) !== recipe.target ||
      !Array.isArray(composition?.sources) ||
      composition.sources.length !== recipe.sources.length
    ) {
      return false;
    }
    return recipe.sources.every((required) =>
      composition.sources.some(
        (actual) =>
          actual?.sourceSystem === required.sourceSystem &&
          asNumber(actual?.requestedRecordCount) ===
            required.requestedRecordCount,
      ),
    );
  });
}

export function classifyPreflight(options) {
  if (!options.sourceStatuses) {
    return legacyClassify(options);
  }

  const {
    profile,
    storageEstimate,
    freeDiskBytes,
    baselineMeasurement,
    sourceStatuses,
    compositions = [],
    projectionEvidence = [],
    currentProjection = null,
    activeProfile = null,
  } = options;
  const recipe = PROFILE_RECIPES[profile];
  const progress = sourceProgress(recipe, sourceStatuses);
  const retained = progress.reduce(
    (sum, source) => sum + source.creditedRecordCount,
    0,
  );
  const allSourceQuotasReady = progress.every((source) => source.quotaReady);
  const baselineReady =
    baselineMeasurement != null &&
    (asNumber(baselineMeasurement.retainedFederatedCount) ?? 0) >= 100000;
  const diskKnown = Number.isFinite(freeDiskBytes);
  const diskReady =
    storageEstimate &&
    diskKnown &&
    freeDiskBytes >= storageEstimate.recommendedFreeBytes;
  const composition = exactComposition(profile, recipe, compositions);
  const linkedProjection = composition
    ? (projectionEvidence.find(
        (entry) =>
          entry?.compositionSha256 === composition.compositionSha256 &&
          entry?.corpusProfile === profile &&
          asNumber(entry?.federatedRecordCount) === recipe.target,
      ) ?? null)
    : null;
  const activeTargetReady =
    linkedProjection != null &&
    activeProfile === profile &&
    currentProjection?.projectionId === linkedProjection.projectionId &&
    asNumber(currentProjection?.objectCount) ===
      asNumber(linkedProjection.projectionObjectCount);

  const checks = [
    check(
      'historical-100k-baseline',
      baselineReady ? 'READY' : 'BLOCKED',
      baselineReady
        ? `Persisted FEDERATED_100K storage evidence is available from projection ${baselineMeasurement.projectionId ?? 'unknown'}. Current active profile does not invalidate historical baseline evidence.`
        : 'A persisted FEDERATED_100K storage baseline is required before growth.',
    ),
    check(
      'storage-baseline',
      storageEstimate ? 'READY' : 'BLOCKED',
      storageEstimate
        ? `Storage estimate uses ${storageEstimate.lowerBaselineProfile ?? 'single-point'} and ${storageEstimate.upperBaselineProfile}.`
        : 'A measured upper storage baseline is required.',
    ),
    check(
      'disk-headroom',
      !diskKnown ? 'UNKNOWN' : diskReady ? 'READY' : 'BLOCKED',
      !diskKnown
        ? 'Local free disk could not be measured.'
        : storageEstimate
          ? `${formatBytes(freeDiskBytes)} free; ${formatBytes(storageEstimate.recommendedFreeBytes)} recommended before growth/projection.`
          : `${formatBytes(freeDiskBytes)} free; storage requirement unavailable.`,
    ),
    ...progress.flatMap((source) => [
      check(
        `source-${source.sourceSystem.toLowerCase()}-quota`,
        source.quotaReady ? 'READY' : 'PENDING',
        `${source.retainedRecordCount.toLocaleString('en-US')} / ${source.requestedRecordCount.toLocaleString('en-US')} retained for ${source.sourceSystem}.`,
      ),
      check(
        `source-${source.sourceSystem.toLowerCase()}-checkpoint`,
        source.resumableRun || source.latestRun ? 'READY' : 'PENDING',
        source.resumableRun
          ? `Durable ${source.resumableRun.status ?? 'unknown'} run ${source.resumableRun.runId ?? ''} can resume.`
          : source.latestRun
            ? `Latest durable run ${source.latestRun.runId ?? ''} is available.`
            : `No durable ${source.sourceSystem} harvest checkpoint is visible yet.`,
      ),
    ]),
    check(
      'composite-manifest',
      composition ? 'READY' : 'PENDING',
      composition
        ? `Exact ${profile} composition ${composition.compositionSha256} is captured.`
        : `No exact ${profile} composition exists yet for ${recipe.sources.map((source) => `${source.requestedRecordCount.toLocaleString('en-US')} ${source.sourceSystem}`).join(' + ')}.`,
    ),
    check(
      'projection-linkage',
      linkedProjection ? 'READY' : 'PENDING',
      linkedProjection
        ? `Composition is linked to projection ${linkedProjection.projectionId}.`
        : 'No durable composition-to-projection evidence exists yet.',
    ),
    check(
      'active-target-evidence',
      activeTargetReady ? 'READY' : 'PENDING',
      activeTargetReady
        ? `${profile} is currently active on linked projection ${linkedProjection.projectionId}.`
        : `${profile} is not currently active on its linked projection.`,
    ),
  ];

  const blocked = checks.some((entry) => entry.status === 'BLOCKED');
  const overallStatus = blocked
    ? 'BLOCKED'
    : allSourceQuotasReady &&
        composition &&
        linkedProjection &&
        activeTargetReady
      ? 'READY_TO_MEASURE'
      : 'READY_TO_GROW';

  return {
    profile,
    targetRetainedRecords: recipe.target,
    retainedRecordCount: retained,
    remainingRecordCount: Math.max(0, recipe.target - retained),
    sourceProgress: progress,
    compositionSha256: composition?.compositionSha256 ?? null,
    projectionId: linkedProjection?.projectionId ?? null,
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

function renderRecipe(sourceProgress) {
  if (!sourceProgress?.length) {
    return '';
  }
  const rows = sourceProgress
    .map(
      (source) =>
        `| ${source.sourceSystem} | ${source.retainedRecordCount.toLocaleString('en-US')} | ${source.requestedRecordCount.toLocaleString('en-US')} | ${source.remainingRecordCount.toLocaleString('en-US')} |`,
    )
    .join('\n');
  return `\n## C2 source recipe\n\n| Source | Retained | Required | Remaining |\n| --- | ---: | ---: | ---: |\n${rows}\n`;
}

export function renderPreflightMarkdown(result) {
  const estimate = result.storageEstimate;
  const componentRows = estimate
    ? STORAGE_FIELDS.map((field) => {
        const value = estimate.components[field];
        return `| ${field} | ${formatBytes(value.bytes)} | ${value.method} | ${value.bytesPerAdditionalRecord === null ? 'n/a' : value.bytesPerAdditionalRecord.toFixed(2)} |`;
      }).join('\n')
    : '| unavailable | n/a | insufficient baseline | n/a |';

  return `# Research Scale Preflight — ${result.profile}\n\nCaptured: ${result.capturedAt}\n\n## Status\n\n- Overall: **${result.readiness.overallStatus}**\n- Retained toward recipe: **${result.readiness.retainedRecordCount.toLocaleString('en-US')} / ${result.readiness.targetRetainedRecords.toLocaleString('en-US')}**\n- Remaining: **${result.readiness.remainingRecordCount.toLocaleString('en-US')}**\n- Local free disk: **${result.freeDiskBytes === null ? 'unknown' : formatBytes(result.freeDiskBytes)}**\n${renderRecipe(result.readiness.sourceProgress)}\n| Check | Status | Detail |\n| --- | --- | --- |\n${renderChecks(result.readiness.checks)}\n\n## Storage projection\n\nThis is a research estimate, not a production capacity guarantee. PostgreSQL, Solr, and OpenSearch are projected from measured per-record growth. DSpace is held at the measured upper-baseline footprint because federated records are metadata references rather than mirrored binaries.\n\n| Component | Estimated 1M footprint | Method | Bytes / additional retained record |\n| --- | ---: | --- | ---: |\n${componentRows}\n\n${
    estimate
      ? `- Current measured local footprint: **${formatBytes(estimate.currentMeasuredBytes)}**\n- Estimated steady 1M footprint: **${formatBytes(estimate.estimatedSteadyBytes)}**\n- Conservative peak estimate including current derived indexes during projection: **${formatBytes(estimate.estimatedPeakBytes)}**\n- Minimum additional free space from current state: **${formatBytes(estimate.minimumAdditionalFreeBytes)}**\n- Recommended free space with ${estimate.safetyMarginPercent}% research margin: **${formatBytes(estimate.recommendedFreeBytes)}**`
      : '- Storage estimate unavailable.'
  }\n\n## Next action\n\n${result.readiness.overallStatus === 'BLOCKED' ? 'Resolve BLOCKED prerequisites before growing the corpus.' : result.readiness.overallStatus === 'READY_TO_MEASURE' ? 'The exact composite corpus is active on its linked projection; the full 1M research report may run.' : 'Infrastructure prerequisites are ready for controlled per-source growth. Harvest each source to its exact quota, capture the composite manifest, project that composition, capture storage evidence, and rerun this preflight before measurement.'}\n\nThe preflight never mutates corpus state and never substitutes a smaller corpus for the requested profile.\n`;
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
  const recipe = PROFILE_RECIPES[profile];
  const overview = await fetchJson(fetchImpl, `${root}/admin/corpus/storage`);
  const lowerMeasurement = measurementForProfile(overview, 'FEDERATED_10K');
  const upperMeasurement = measurementForProfile(overview, 'FEDERATED_100K');
  const storageEstimate = estimateStorageAtTarget({
    lowerMeasurement,
    upperMeasurement,
    targetRetained: recipe.target,
  });
  const freeDiskBytes = await diskProvider();

  let readiness;
  let evidence;
  if (!recipe.composite) {
    const [baselineEvidence, targetEvidence, harvestStatus] = await Promise.all([
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
    ]);
    readiness = legacyClassify({
      profile,
      storageEstimate,
      freeDiskBytes,
      baselineEvidence,
      targetEvidence,
      harvestStatus,
    });
    evidence = {
      baseline: baselineEvidence,
      target: targetEvidence,
      harvest: harvestStatus,
    };
  } else {
    const sourceEntries = await Promise.all(
      recipe.sources.map(async (source) => [
        source.sourceSystem,
        await fetchJson(
          fetchImpl,
          `${root}/admin/federation/harvest/status?sourceSystem=${encodeURIComponent(source.sourceSystem)}`,
        ),
      ]),
    );
    const [compositions, projectionEvidence, currentProjection] =
      await Promise.all([
        fetchJson(
          fetchImpl,
          `${root}/admin/federation/compositions?corpusProfile=${encodeURIComponent(profile)}&limit=20`,
        ),
        fetchJson(
          fetchImpl,
          `${root}/admin/federation/compositions/projections?corpusProfile=${encodeURIComponent(profile)}&limit=20`,
        ),
        fetchJson(fetchImpl, `${root}/admin/reindex`),
      ]);
    const sourceStatuses = Object.fromEntries(sourceEntries);
    readiness = classifyPreflight({
      profile,
      storageEstimate,
      freeDiskBytes,
      baselineMeasurement: upperMeasurement,
      sourceStatuses,
      compositions,
      projectionEvidence,
      currentProjection,
      activeProfile: overview?.activeProfile ?? null,
    });
    evidence = {
      historicalBaselineMeasurement: upperMeasurement,
      sourceStatuses,
      compositions,
      projectionEvidence,
      currentProjection,
      activeProfile: overview?.activeProfile ?? null,
    };
  }

  const result = {
    kind: 'civics-research-scale-preflight',
    capturedAt: now().toISOString(),
    profile,
    freeDiskBytes,
    storageEstimate,
    readiness,
    evidence,
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

export async function main(argv = process.argv.slice(2)) {
  const options = parseArguments(argv);
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

if (process.argv[1] && import.meta.url === new URL(`file://${resolve(process.argv[1]).replace(/\\/g, '/')}`).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
