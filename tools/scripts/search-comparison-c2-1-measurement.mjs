import { execFile } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import { waitForApiReady } from './cursor-traversal-evidence.mjs';
import {
  C2_1_RESTART_BLOCKS,
  C2_1_BATCHES_PER_BLOCK,
  C2_1_ROOT_SEED,
  buildC21RestartExecutionPlan,
  summarizeC21TimingSamples,
} from './search-comparison-c2-1-foundation.mjs';
import {
  C2_1_EXPECTED,
  sha256Json,
} from './search-comparison-c2-1-manifest.mjs';
import { writeC21PreflightAuthorization } from './search-comparison-c2-1-preflight.mjs';
import {
  C2_1_ADMITTED_TREATMENT,
  buildC21SemanticCells,
} from './search-comparison-c2-1-semantic-admission.mjs';
import { runSearchComparisonBenchmark } from './search-comparison-benchmark.mjs';

const execFileAsync = promisify(execFile);

const DEFAULT_BASE_URL = 'http://localhost:8080/api';
const DEFAULT_OUTPUT = 'browser-evidence-artifacts/c2-1/measurement-suite.json';
const DEFAULT_WARMUP_RUNS = 5;
const DEFAULT_MEASURED_RUNS = 10;

function requirePositiveInteger(value, label) {
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${label} must be a positive integer.`);
  }
  return value;
}

function twoDigit(value) {
  return String(value).padStart(2, '0');
}

function requireSameExecutionPlan(expected, actual) {
  if (sha256Json(expected) !== sha256Json(actual)) {
    throw new Error(
      'C2.1 block preflight execution plan drifted after stack recreation.',
    );
  }
}

export function validateC21TimingAuthorization(authorization) {
  if (authorization?.experiment !== 'C2.1_ADVERSARIAL_STANDALONE') {
    throw new Error('C2.1 measurement requires a C2.1 authorization.');
  }
  if (authorization?.kind !== 'preflight-authorization') {
    throw new Error('C2.1 measurement requires preflight authorization.');
  }
  if (
    authorization?.status !== 'READY' ||
    authorization?.timingAllowed !== true
  ) {
    throw new Error('C2.1 measurement requires READY timing authorization.');
  }
  if (authorization?.comparativeClaimAllowed !== false) {
    throw new Error(
      'C2.1 measurement requires the comparative-claim guardrail.',
    );
  }
  if (authorization?.projectionId !== C2_1_EXPECTED.projectionId) {
    throw new Error('C2.1 measurement refuses projection drift.');
  }
  if (
    Number(authorization?.projectionObjectCount) !==
    C2_1_EXPECTED.projectionObjectCount
  ) {
    throw new Error('C2.1 measurement refuses projection-count drift.');
  }
  if (authorization?.openSearchTreatment !== C2_1_ADMITTED_TREATMENT) {
    throw new Error(`C2.1 measurement requires ${C2_1_ADMITTED_TREATMENT}.`);
  }
  if (!/^[0-9a-f]{64}$/u.test(String(authorization?.manifestSha256 ?? ''))) {
    throw new Error('C2.1 authorization must bind a manifest SHA-256.');
  }
  if (
    !/^[0-9a-f]{64}$/u.test(
      String(authorization?.semanticAdmissionSha256 ?? ''),
    )
  ) {
    throw new Error('C2.1 authorization must bind semantic-admission SHA-256.');
  }
  if (!authorization?.executionPlan?.blocks?.length) {
    throw new Error('C2.1 authorization must include a restart-block plan.');
  }
  return authorization;
}

export function buildC21MeasurementCells(authorization) {
  const preparedAuthorization = validateC21TimingAuthorization(authorization);
  const cells = buildC21SemanticCells({
    bands: preparedAuthorization.filterBands ?? [],
  });
  if (cells.length < 21) {
    throw new Error(
      'C2.1 measurement requires Q01-Q20 plus corpus-wide facets.',
    );
  }
  return cells.map((cell) => ({
    id: cell.id,
    family: cell.family,
    class: cell.class ?? null,
    band: cell.band ?? null,
    selected: cell.selected ?? null,
    request: cell.request,
  }));
}

export function applyC21TimingContract(benchmark) {
  const copy = JSON.parse(JSON.stringify(benchmark));
  copy.solr.elapsed = summarizeC21TimingSamples(
    copy.rawSamples.apiElapsed.solrMs,
  );
  copy.openSearch.elapsed = summarizeC21TimingSamples(
    copy.rawSamples.apiElapsed.openSearchMs,
  );
  copy.solr.engineReported = summarizeC21TimingSamples(
    copy.rawSamples.engineReported.solrMs,
  );
  copy.openSearch.engineReported = summarizeC21TimingSamples(
    copy.rawSamples.engineReported.openSearchMs,
  );
  copy.c21PercentileContract = 'p50/p90/p95/p99';
  return copy;
}

export async function recreateC21StandaloneStack({
  execFileImpl = execFileAsync,
  baseUrl = DEFAULT_BASE_URL,
  waitForReady = waitForApiReady,
} = {}) {
  await execFileImpl(
    'docker',
    [
      'compose',
      '-f',
      'docker-compose.yml',
      '-f',
      'docker-compose.c2-1.yml',
      'up',
      '-d',
      '--force-recreate',
      '--wait',
      '--wait-timeout',
      '300',
      'repository-api',
      'solr',
      'opensearch',
    ],
    { maxBuffer: 16 * 1024 * 1024 },
  );
  await waitForReady({ baseUrl });
}

export async function runC21MeasurementSuite({
  authorization = null,
  authorizePreflight = writeC21PreflightAuthorization,
  runBenchmark = runSearchComparisonBenchmark,
  recreateStack = recreateC21StandaloneStack,
  baseUrl = DEFAULT_BASE_URL,
  warmupRuns = DEFAULT_WARMUP_RUNS,
  measuredRuns = DEFAULT_MEASURED_RUNS,
  recreateBetweenBlocks = true,
  now = () => new Date(),
} = {}) {
  requirePositiveInteger(warmupRuns, 'warmupRuns');
  requirePositiveInteger(measuredRuns, 'measuredRuns');

  let acceptedEvidence = recreateBetweenBlocks;
  let executionPlan = authorization
    ? validateC21TimingAuthorization(authorization).executionPlan
    : buildC21RestartExecutionPlan({
        rootSeed: C2_1_ROOT_SEED,
        restartBlocks: C2_1_RESTART_BLOCKS,
        batchesPerBlock: C2_1_BATCHES_PER_BLOCK,
      });
  let matrix = authorization ? buildC21MeasurementCells(authorization) : null;

  const restartBlocks = [];
  for (const block of executionPlan.blocks) {
    if (recreateBetweenBlocks) {
      await recreateStack({ block, baseUrl });
    }

    const blockAuthorization = authorization
      ? validateC21TimingAuthorization(authorization)
      : validateC21TimingAuthorization(
          (
            await authorizePreflight({
              output: `browser-evidence-artifacts/c2-1/restart-block-${twoDigit(block.blockId)}/preflight-authorization.json`,
              manifestOutput: `browser-evidence-artifacts/c2-1/restart-block-${twoDigit(block.blockId)}/execution-manifest.json`,
              semanticOutput: `browser-evidence-artifacts/c2-1/restart-block-${twoDigit(block.blockId)}/semantic-admission.json`,
            })
          ).authorization,
        );

    if (authorization) {
      acceptedEvidence = false;
    }
    requireSameExecutionPlan(executionPlan, blockAuthorization.executionPlan);
    executionPlan = blockAuthorization.executionPlan;
    matrix ??= buildC21MeasurementCells(blockAuthorization);

    const workloads = [];
    for (const cell of matrix) {
      const benchmark = await runBenchmark({
        baseUrl,
        warmupRuns,
        measuredRuns,
        batches: block.batchExecutionOrders.length,
        executionOrder: block.requestedStartingOrder,
        executionOrderPlan: block.batchExecutionOrders,
        openSearchTreatment: blockAuthorization.openSearchTreatment,
        request: cell.request,
        now,
      });
      if (benchmark?.projection?.projectionId !== C2_1_EXPECTED.projectionId) {
        throw new Error(`${cell.id}: C2.1 benchmark projection drifted.`);
      }
      if (benchmark?.openSearchTreatment !== C2_1_ADMITTED_TREATMENT) {
        throw new Error(`${cell.id}: C2.1 benchmark used the wrong treatment.`);
      }
      workloads.push({
        ...cell,
        benchmark: applyC21TimingContract(benchmark),
      });
    }

    restartBlocks.push({
      blockId: block.blockId,
      seed: block.seed,
      requestedStartingOrder: block.requestedStartingOrder,
      batchExecutionOrders: [...block.batchExecutionOrders],
      preflightAuthorizationSha256: sha256Json(blockAuthorization),
      repositoryCommit: blockAuthorization.repositoryCommit,
      protocol: blockAuthorization.protocol,
      manifestSha256: blockAuthorization.manifestSha256,
      semanticAdmissionSha256: blockAuthorization.semanticAdmissionSha256,
      workloads,
    });
  }

  return {
    experiment: 'C2.1_ADVERSARIAL_STANDALONE',
    kind: 'measurement-suite',
    capturedAt: now().toISOString(),
    profile: C2_1_EXPECTED.profile,
    projectionId: C2_1_EXPECTED.projectionId,
    projectionObjectCount: C2_1_EXPECTED.projectionObjectCount,
    timingAllowed: true,
    acceptedC21Evidence: acceptedEvidence,
    comparativeClaimAllowed: false,
    semanticAdmissionTimingExcluded: true,
    openSearchTreatment: C2_1_ADMITTED_TREATMENT,
    warmupRunsPerCellBatch: warmupRuns,
    measuredRunsPerCellBatch: measuredRuns,
    executionPlan,
    workloadMatrix: matrix,
    restartBlocks,
    guardrail:
      'Accepted C2.1 evidence requires per-block stack recreation and per-block READY preflight authorization. The result remains scoped to the certified corpus/projection, named OpenSearch treatment and standalone Docker topology.',
  };
}

export async function writeC21MeasurementSuite({
  output = DEFAULT_OUTPUT,
  ...options
} = {}) {
  const suite = await runC21MeasurementSuite(options);
  const outputPath = resolve(output);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(suite, null, 2)}\n`, 'utf8');
  return { suite, outputPath };
}

export function parseArguments(argv) {
  const options = {
    baseUrl: DEFAULT_BASE_URL,
    output: DEFAULT_OUTPUT,
    warmupRuns: DEFAULT_WARMUP_RUNS,
    measuredRuns: DEFAULT_MEASURED_RUNS,
    recreateBetweenBlocks: true,
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
      case '--output':
        options.output = value;
        index += 1;
        break;
      case '--warmups':
        options.warmupRuns = Number(value);
        index += 1;
        break;
      case '--samples':
        options.measuredRuns = Number(value);
        index += 1;
        break;
      case '--skip-restarts':
        options.recreateBetweenBlocks = false;
        break;
      default:
        throw new Error(`Unknown C2.1 measurement argument: ${argument}`);
    }
  }

  return options;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const options = parseArguments(process.argv.slice(2));
  writeC21MeasurementSuite(options)
    .then(({ suite, outputPath }) => {
      console.log(`C2.1 measurement suite written to ${outputPath}`);
      console.log(
        `Accepted evidence: ${suite.acceptedC21Evidence ? 'yes' : 'no'}; blocks ${suite.restartBlocks.length}; workloads ${suite.workloadMatrix.length}; treatment ${suite.openSearchTreatment}`,
      );
      console.log(suite.guardrail);
    })
    .catch((error) => {
      console.error(`C2.1 measurement REFUSED: ${error.message}`);
      process.exitCode = 1;
    });
}
