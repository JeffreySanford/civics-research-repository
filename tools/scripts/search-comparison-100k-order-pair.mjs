import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  adaptiveScenarios,
  discoverSelectiveProgram,
} from './search-comparison-100k-adaptive.mjs';
import {
  runHundredKSearchComparisonMatrix,
  summarizeHostContext,
} from './search-comparison-100k-matrix.mjs';

const DEFAULT_BASE_URL = 'http://localhost:8080/api';
const DEFAULT_OUTPUT =
  'browser-evidence-artifacts/search-comparison-100k-order-pair.json';

function selectiveFilter(program, projectedCount) {
  return {
    field: 'program',
    value: program.value,
    matchingDocuments: program.count,
    selectivityPercent:
      Math.round((program.count / projectedCount) * 10000) / 100,
  };
}

function scenarioSummary(solrFirst, openSearchFirst) {
  return solrFirst.scenarios.map((firstScenario) => {
    const reversedScenario = openSearchFirst.scenarios.find(
      (scenario) => scenario.id === firstScenario.id,
    );
    if (!reversedScenario) {
      throw new Error(
        `Missing reversed-order result for scenario ${firstScenario.id}.`,
      );
    }

    const solrLeadsP50BothOrders =
      firstScenario.solr.elapsed.p50Ms <
        firstScenario.openSearch.elapsed.p50Ms &&
      reversedScenario.solr.elapsed.p50Ms <
        reversedScenario.openSearch.elapsed.p50Ms;
    const solrLeadsP95BothOrders =
      firstScenario.solr.elapsed.p95Ms <
        firstScenario.openSearch.elapsed.p95Ms &&
      reversedScenario.solr.elapsed.p95Ms <
        reversedScenario.openSearch.elapsed.p95Ms;

    return {
      id: firstScenario.id,
      solrFirst: {
        solrApiP50Ms: firstScenario.solr.elapsed.p50Ms,
        solrApiP95Ms: firstScenario.solr.elapsed.p95Ms,
        openSearchApiP50Ms: firstScenario.openSearch.elapsed.p50Ms,
        openSearchApiP95Ms: firstScenario.openSearch.elapsed.p95Ms,
        solrEngineP50Ms: firstScenario.solr.engineReported.p50Ms,
        solrEngineP95Ms: firstScenario.solr.engineReported.p95Ms,
        openSearchEngineP50Ms: firstScenario.openSearch.engineReported.p50Ms,
        openSearchEngineP95Ms: firstScenario.openSearch.engineReported.p95Ms,
      },
      openSearchFirst: {
        solrApiP50Ms: reversedScenario.solr.elapsed.p50Ms,
        solrApiP95Ms: reversedScenario.solr.elapsed.p95Ms,
        openSearchApiP50Ms: reversedScenario.openSearch.elapsed.p50Ms,
        openSearchApiP95Ms: reversedScenario.openSearch.elapsed.p95Ms,
        solrEngineP50Ms: reversedScenario.solr.engineReported.p50Ms,
        solrEngineP95Ms: reversedScenario.solr.engineReported.p95Ms,
        openSearchEngineP50Ms: reversedScenario.openSearch.engineReported.p50Ms,
        openSearchEngineP95Ms: reversedScenario.openSearch.engineReported.p95Ms,
      },
      solrLeadsP50BothOrders,
      solrLeadsP95BothOrders,
    };
  });
}

export async function runOrderPairedHundredKBenchmark({
  fetchImpl = globalThis.fetch,
  baseUrl = DEFAULT_BASE_URL,
  warmupRuns = 5,
  measuredRuns = 100,
  now = () => new Date(),
  hostContext = summarizeHostContext(),
} = {}) {
  const selectedProgram = await discoverSelectiveProgram({
    fetchImpl,
    baseUrl,
  });
  const scenarios = adaptiveScenarios(selectedProgram);

  const solrFirst = await runHundredKSearchComparisonMatrix({
    fetchImpl,
    baseUrl,
    warmupRuns,
    measuredRuns,
    executionOrder: 'SOLR_FIRST',
    scenarios,
    now,
    hostContext,
  });
  const openSearchFirst = await runHundredKSearchComparisonMatrix({
    fetchImpl,
    baseUrl,
    warmupRuns,
    measuredRuns,
    executionOrder: 'OPENSEARCH_FIRST',
    scenarios,
    now,
    hostContext,
  });

  const projectionId = solrFirst.evidence.currentProjectionId;
  if (openSearchFirst.evidence.currentProjectionId !== projectionId) {
    throw new Error(
      'Projection changed between execution-order benchmark passes.',
    );
  }
  if (
    openSearchFirst.evidence.currentProjectionObjectCount !==
    solrFirst.evidence.currentProjectionObjectCount
  ) {
    throw new Error(
      'Projection document count changed between execution-order benchmark passes.',
    );
  }

  return {
    kind: 'federated-100k-search-comparison-order-pair',
    capturedAt: now().toISOString(),
    profile: solrFirst.profile,
    projection: {
      projectionId,
      objectCount: solrFirst.evidence.currentProjectionObjectCount,
    },
    selectedFilter: selectiveFilter(
      selectedProgram,
      solrFirst.evidence.currentProjectionObjectCount,
    ),
    hostContext,
    warmupRuns,
    measuredRuns,
    comparativeClaimAllowed: false,
    methodology:
      'The same workload matrix, selective program and deterministic 100K projection are measured twice: once with Solr first and once with OpenSearch first. The matrix covers full text, facets, broad filtering and selective filtering. Warmups are excluded in both passes. API elapsed and engine-native QTime/took distributions are retained separately. A lead that survives both execution orders is more robust against ordering effects, but results remain local single-topology diagnostics rather than universal engine performance claims.',
    passes: {
      SOLR_FIRST: solrFirst,
      OPENSEARCH_FIRST: openSearchFirst,
    },
    orderRobustness: scenarioSummary(solrFirst, openSearchFirst),
  };
}

export function parseArguments(argv) {
  const options = {
    baseUrl: DEFAULT_BASE_URL,
    warmupRuns: 5,
    measuredRuns: 100,
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
      case '--warmups':
        options.warmupRuns = Number(value);
        index += 1;
        break;
      case '--samples':
        options.measuredRuns = Number(value);
        index += 1;
        break;
      case '--output':
        options.output = value;
        index += 1;
        break;
      default:
        throw new Error(`Unknown paired 100K benchmark argument: ${argument}`);
    }
  }
  return options;
}

function printPass(order, pass) {
  console.log(`\n${order}`);
  for (const scenario of pass.scenarios) {
    console.log(
      `${scenario.id}: Solr API p50/p95/p99 ${scenario.solr.elapsed.p50Ms}/${scenario.solr.elapsed.p95Ms}/${scenario.solr.elapsed.p99Ms} ms; OpenSearch API p50/p95/p99 ${scenario.openSearch.elapsed.p50Ms}/${scenario.openSearch.elapsed.p95Ms}/${scenario.openSearch.elapsed.p99Ms} ms`,
    );
    console.log(
      `${scenario.id}: Solr QTime p50/p95/p99 ${scenario.solr.engineReported.p50Ms}/${scenario.solr.engineReported.p95Ms}/${scenario.solr.engineReported.p99Ms} ms; OpenSearch took p50/p95/p99 ${scenario.openSearch.engineReported.p50Ms}/${scenario.openSearch.engineReported.p95Ms}/${scenario.openSearch.engineReported.p99Ms} ms`,
    );
  }
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const result = await runOrderPairedHundredKBenchmark({
    baseUrl: options.baseUrl,
    warmupRuns: options.warmupRuns,
    measuredRuns: options.measuredRuns,
  });

  const outputPath = resolve(options.output);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8');

  console.log(`Paired 100K search comparison written to ${outputPath}`);
  console.log(
    `Projection: ${result.projection.projectionId} (${result.projection.objectCount} documents)`,
  );
  console.log(
    `Selective filter: program=${JSON.stringify(result.selectedFilter.value)}, ${result.selectedFilter.matchingDocuments} documents (${result.selectedFilter.selectivityPercent}%)`,
  );
  printPass('SOLR_FIRST', result.passes.SOLR_FIRST);
  printPass('OPENSEARCH_FIRST', result.passes.OPENSEARCH_FIRST);
  console.log('\nOrder robustness');
  for (const scenario of result.orderRobustness) {
    console.log(
      `${scenario.id}: Solr leads p50 both orders=${scenario.solrLeadsP50BothOrders}; p95 both orders=${scenario.solrLeadsP95BothOrders}`,
    );
  }
  console.log(result.methodology);
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
