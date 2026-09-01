import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

import { runResearchScalePreflight } from './research-scale-preflight.mjs';

const DEFAULT_BASE_URL = 'http://localhost:8080/api';
const DEFAULT_PROFILE = 'FEDERATED_1M';
const DEFAULT_OUTPUT =
  'browser-evidence-artifacts/scale-evidence/federated-1m-check.json';

const PROFILE_REQUIREMENTS = Object.freeze({
  FEDERATED_100K: Object.freeze({
    targetFederatedRecordCount: 100000,
    composite: false,
    sources: Object.freeze([
      Object.freeze({ sourceSystem: 'DATA_GOV', requestedRecordCount: 100000 }),
    ]),
  }),
  FEDERATED_1M: Object.freeze({
    targetFederatedRecordCount: 1000000,
    composite: true,
    sources: Object.freeze([
      Object.freeze({ sourceSystem: 'DATA_GOV', requestedRecordCount: 500000 }),
      Object.freeze({ sourceSystem: 'DOE_OSTI', requestedRecordCount: 500000 }),
    ]),
  }),
});

function requireProfile(profile) {
  if (!(profile in PROFILE_REQUIREMENTS)) {
    throw new Error(
      `profile must be one of ${Object.keys(PROFILE_REQUIREMENTS).join(', ')}.`,
    );
  }
  return profile;
}

function asNumber(value) {
  return Number.isFinite(Number(value)) ? Number(value) : null;
}

function isSha256(value) {
  return typeof value === 'string' && /^[0-9a-f]{64}$/u.test(value);
}

function check(id, pass, detail) {
  return { id, status: pass ? 'PASS' : 'FAIL', detail };
}

function readinessSourceProgress(preflight, requirements) {
  if (Array.isArray(preflight?.readiness?.sourceProgress)) {
    return preflight.readiness.sourceProgress;
  }

  if (requirements.sources.length === 1) {
    const retained =
      asNumber(preflight?.evidence?.harvest?.retainedRecordCount) ?? 0;
    return [
      {
        ...requirements.sources[0],
        retainedRecordCount: retained,
      },
    ];
  }

  return [];
}

function exactRecipeMatches(progress, requirements) {
  if (progress.length !== requirements.sources.length) {
    return false;
  }
  return requirements.sources.every((required) =>
    progress.some(
      (actual) =>
        actual?.sourceSystem === required.sourceSystem &&
        asNumber(actual?.requestedRecordCount) ===
          required.requestedRecordCount &&
        (asNumber(actual?.retainedRecordCount) ?? 0) >=
          required.requestedRecordCount,
    ),
  );
}

function publicProvenanceCheck(source, response) {
  const totalResults = asNumber(response?.totalResults) ?? 0;
  const results = Array.isArray(response?.results) ? response.results : [];
  const sample = results[0] ?? null;
  const expectedTotal = source.requestedRecordCount;
  const sourceMatches = sample?.sourceSystem === source.sourceSystem;
  const originMatches = sample?.origin === 'FEDERATED';
  const sourceUrlPresent =
    typeof sample?.sourceUrl === 'string' &&
    /^https?:\/\//u.test(sample.sourceUrl);
  const pass =
    totalResults === expectedTotal &&
    sample != null &&
    sourceMatches &&
    originMatches &&
    sourceUrlPresent;

  return check(
    `public-search-${source.sourceSystem.toLowerCase()}-provenance`,
    pass,
    pass
      ? `${source.sourceSystem} public search exposes ${totalResults.toLocaleString('en-US')} results with FEDERATED origin, matching sourceSystem, and an authoritative source URL.`
      : `${source.sourceSystem} public search expected ${expectedTotal.toLocaleString('en-US')} results and a FEDERATED sample with matching sourceSystem/sourceUrl; observed total=${totalResults.toLocaleString('en-US')}, origin=${sample?.origin ?? 'missing'}, sourceSystem=${sample?.sourceSystem ?? 'missing'}.`,
  );
}

export function classifyScaleEvidence({
  profile,
  preflight,
  scaleEvidence,
  publicSearchBySource,
}) {
  const selectedProfile = requireProfile(profile);
  const requirements = PROFILE_REQUIREMENTS[selectedProfile];
  const sourceProgress = readinessSourceProgress(preflight, requirements);
  const target = requirements.targetFederatedRecordCount;
  const currentProjectionId = scaleEvidence?.currentProjectionId ?? null;
  const currentProjectionObjectCount =
    asNumber(scaleEvidence?.currentProjectionObjectCount) ?? 0;
  const activationProjectionObjectCount = asNumber(
    scaleEvidence?.activationProjectionObjectCount,
  );
  const storageProjectionObjectCount = asNumber(
    scaleEvidence?.storageProjectionObjectCount,
  );
  const retainedFederatedRecordCount =
    asNumber(scaleEvidence?.retainedFederatedRecordCount) ?? 0;
  const preflightProjectionId = preflight?.readiness?.projectionId ?? null;
  const compositionSha256 = preflight?.readiness?.compositionSha256 ?? null;

  const checks = [
    check(
      'preflight-ready-to-measure',
      preflight?.readiness?.overallStatus === 'READY_TO_MEASURE',
      `Research preflight status is ${preflight?.readiness?.overallStatus ?? 'missing'}.`,
    ),
    check(
      'retained-target',
      retainedFederatedRecordCount >= target,
      `${retainedFederatedRecordCount.toLocaleString('en-US')} retained federated records; ${target.toLocaleString('en-US')} required.`,
    ),
    check(
      'exact-source-recipe',
      exactRecipeMatches(sourceProgress, requirements),
      requirements.sources
        .map(
          (source) =>
            `${source.requestedRecordCount.toLocaleString('en-US')} ${source.sourceSystem}`,
        )
        .join(' + '),
    ),
    check(
      'scale-evidence-valid',
      scaleEvidence?.valid === true &&
        Array.isArray(scaleEvidence?.violations) &&
        scaleEvidence.violations.length === 0,
      scaleEvidence?.valid === true
        ? `${selectedProfile} scale evidence is valid with no violations.`
        : `Scale evidence is invalid: ${(scaleEvidence?.violations ?? []).join('; ') || 'no violation details returned'}.`,
    ),
    check(
      'active-profile',
      scaleEvidence?.activeProfile === selectedProfile,
      `Active profile is ${scaleEvidence?.activeProfile ?? 'missing'}; expected ${selectedProfile}.`,
    ),
    check(
      'persisted-activation-runtime-identity',
      isSha256(scaleEvidence?.activationProjectionId) &&
        scaleEvidence.activationProjectionId === currentProjectionId &&
        activationProjectionObjectCount === currentProjectionObjectCount &&
        currentProjectionObjectCount > 0,
      `Persisted activation ${scaleEvidence?.activationProjectionId ?? 'missing'} / ${activationProjectionObjectCount ?? 'missing'} objects; runtime ${currentProjectionId ?? 'missing'} / ${currentProjectionObjectCount} objects.`,
    ),
    check(
      'search-target-parity',
      scaleEvidence?.targetParity === true,
      scaleEvidence?.targetParity === true
        ? 'Enabled search targets report parity with the current projection.'
        : 'Search target parity is false.',
    ),
    check(
      'storage-evidence',
      scaleEvidence?.storageEvidencePresent === true &&
        scaleEvidence?.storageProjectionId === currentProjectionId &&
        storageProjectionObjectCount === currentProjectionObjectCount &&
        (asNumber(scaleEvidence?.storageRetainedFederatedCount) ?? 0) >= target,
      `Storage evidence projection ${scaleEvidence?.storageProjectionId ?? 'missing'} / ${storageProjectionObjectCount ?? 'missing'} objects; retained=${asNumber(scaleEvidence?.storageRetainedFederatedCount) ?? 'missing'}.`,
    ),
  ];

  if (requirements.composite) {
    checks.push(
      check(
        'composition-projection-linkage',
        isSha256(compositionSha256) &&
          isSha256(preflightProjectionId) &&
          preflightProjectionId === currentProjectionId,
        `Composition ${compositionSha256 ?? 'missing'} is linked by preflight to ${preflightProjectionId ?? 'missing'}; runtime projection is ${currentProjectionId ?? 'missing'}.`,
      ),
    );
  }

  for (const source of requirements.sources) {
    checks.push(
      publicProvenanceCheck(
        source,
        publicSearchBySource?.[source.sourceSystem],
      ),
    );
  }

  const passed = checks.every((entry) => entry.status === 'PASS');
  return {
    kind: 'civics-scale-evidence-check',
    profile: selectedProfile,
    status: passed ? 'PASS' : 'FAIL',
    targetFederatedRecordCount: target,
    retainedFederatedRecordCount,
    compositionSha256: requirements.composite ? compositionSha256 : null,
    projectionId: currentProjectionId,
    projectionObjectCount: currentProjectionObjectCount,
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

export async function runScaleEvidenceCheck({
  fetchImpl = globalThis.fetch,
  baseUrl = DEFAULT_BASE_URL,
  profile = DEFAULT_PROFILE,
  diskProvider,
  now = () => new Date(),
} = {}) {
  const selectedProfile = requireProfile(profile);
  const requirements = PROFILE_REQUIREMENTS[selectedProfile];
  const root = baseUrl.replace(/\/$/u, '');
  const preflight = await runResearchScalePreflight({
    fetchImpl,
    baseUrl: root,
    profile: selectedProfile,
    ...(diskProvider ? { diskProvider } : {}),
    now,
  });

  const [scaleEvidence, ...publicSearchResponses] = await Promise.all([
    fetchJson(
      fetchImpl,
      `${root}/admin/corpus/scale/evidence?profile=${encodeURIComponent(selectedProfile)}`,
    ),
    ...requirements.sources.map((source) =>
      fetchJson(
        fetchImpl,
        `${root}/search?sourceSystem=${encodeURIComponent(source.sourceSystem)}&page=0&pageSize=1`,
      ),
    ),
  ]);

  const publicSearchBySource = Object.fromEntries(
    requirements.sources.map((source, index) => [
      source.sourceSystem,
      publicSearchResponses[index],
    ]),
  );
  const result = classifyScaleEvidence({
    profile: selectedProfile,
    preflight,
    scaleEvidence,
    publicSearchBySource,
  });

  return {
    ...result,
    capturedAt: now().toISOString(),
    evidence: {
      preflight: {
        readiness: preflight.readiness,
        freeDiskBytes: preflight.freeDiskBytes,
      },
      scaleEvidence,
      publicSearchBySource,
    },
  };
}

export function renderScaleEvidenceMarkdown(result) {
  const rows = result.checks
    .map((entry) => `| ${entry.id} | ${entry.status} | ${entry.detail} |`)
    .join('\n');
  return `# Scale Evidence Check — ${result.profile}\n\nCaptured: ${result.capturedAt}\n\n- Status: **${result.status}**\n- Retained federated records: **${result.retainedFederatedRecordCount.toLocaleString('en-US')}**\n- Projection objects: **${result.projectionObjectCount.toLocaleString('en-US')}**\n- Composition: \`${result.compositionSha256 ?? 'n/a'}\`\n- Projection: \`${result.projectionId ?? 'missing'}\`\n\n| Check | Status | Detail |\n| --- | --- | --- |\n${rows}\n\nThis command is read-only with respect to corpus, activation, and search-index state.\n`;
}

export function parseArguments(argv) {
  const options = {
    baseUrl: DEFAULT_BASE_URL,
    profile: DEFAULT_PROFILE,
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
      case '--output':
        options.output = value;
        index += 1;
        break;
      default:
        throw new Error(`Unknown scale evidence argument: ${argument}`);
    }
  }
  return options;
}

export async function main(argv = process.argv.slice(2)) {
  const options = parseArguments(argv);
  const result = await runScaleEvidenceCheck({
    baseUrl: options.baseUrl,
    profile: options.profile,
  });
  const outputPath = resolve(options.output);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  const markdownPath = outputPath.replace(/\.json$/iu, '.md');
  const markdown = renderScaleEvidenceMarkdown(result);
  await writeFile(markdownPath, markdown, 'utf8');
  console.log(`Scale evidence JSON written to ${outputPath}`);
  console.log(`Scale evidence Markdown written to ${markdownPath}`);
  console.log(markdown);

  if (result.status !== 'PASS') {
    process.exitCode = 2;
  }
}

if (
  process.argv[1] &&
  import.meta.url ===
    new URL(`file://${resolve(process.argv[1]).replace(/\\/gu, '/')}`).href
) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
