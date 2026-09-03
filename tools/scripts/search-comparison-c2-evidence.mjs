import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { runSearchComparisonBenchmark } from './search-comparison-benchmark.mjs';
import { runTelemetryWrappedConcurrencyMatrix } from './search-comparison-resource-telemetry.mjs';
import {
  renderStatisticalMarkdown,
  synthesizeStatisticalReport,
} from './search-comparison-statistical-report.mjs';

const C2_PROFILE = 'FEDERATED_1M';
const DEFAULT_BASE_URL = 'http://localhost:8080/api';
const DEFAULT_SOLR_BASE_URL = 'http://localhost:8983/solr';
const DEFAULT_OPENSEARCH_BASE_URL = 'http://localhost:9200';
const DEFAULT_RESEARCH_REPORT =
  'browser-evidence-artifacts/research-performance/federated-1m-report.json';
const DEFAULT_OUTPUT_DIR = 'browser-evidence-artifacts';
const DEFAULT_SEED = 20260903;
const DEFAULT_BATCHES = 6;
const DEFAULT_WARMUP_RUNS = 5;
const DEFAULT_MEASURED_RUNS = 20;

function requireResearchReport(report) {
  if (report?.paired?.profile !== C2_PROFILE) {
    throw new Error(
      `C2 evidence requires a ${C2_PROFILE} research-performance report.`,
    );
  }
  const projectionId = report?.paired?.projection?.projectionId;
  if (
    typeof projectionId !== 'string' ||
    !/^[0-9a-f]{64}$/.test(projectionId)
  ) {
    throw new Error(
      'C2 research-performance report must contain a lowercase SHA-256 projection ID.',
    );
  }
  if (!Array.isArray(report?.paired?.orderRobustness)) {
    throw new Error(
      'C2 research-performance report must contain paired order-robustness evidence.',
    );
  }
  return report;
}

export function buildOrderPairEvidence(researchReport) {
  const report = requireResearchReport(researchReport);
  return {
    projection: { ...report.paired.projection },
    orderRobustness: report.paired.orderRobustness.map((scenario) => ({
      id: scenario.id,
      solrLeadsP50BothOrders: scenario.solrLeadsApiP50BothOrders,
      solrLeadsP95BothOrders: scenario.solrLeadsApiP95BothOrders,
    })),
  };
}

export async function runC2EvidenceSuite({
  researchReport,
  runStandaloneBenchmark = runSearchComparisonBenchmark,
  runTelemetryBenchmark = runTelemetryWrappedConcurrencyMatrix,
  synthesizeReport = synthesizeStatisticalReport,
  renderMarkdown = renderStatisticalMarkdown,
  baseUrl = DEFAULT_BASE_URL,
  solrBaseUrl = DEFAULT_SOLR_BASE_URL,
  openSearchBaseUrl = DEFAULT_OPENSEARCH_BASE_URL,
  seed = DEFAULT_SEED,
  batches = DEFAULT_BATCHES,
  warmupRuns = DEFAULT_WARMUP_RUNS,
  measuredRuns = DEFAULT_MEASURED_RUNS,
  now = () => new Date(),
} = {}) {
  const orderPair = buildOrderPairEvidence(researchReport);
  const paired = await runStandaloneBenchmark({
    baseUrl,
    batches,
    warmupRuns,
    measuredRuns,
    executionOrder: 'SOLR_FIRST',
    orderStrategy: 'RANDOMIZED',
    seed,
    now,
  });
  const telemetry = await runTelemetryBenchmark({
    captureOptions: {
      solrBaseUrl,
      openSearchBaseUrl,
    },
    benchmarkOptions: {
      baseUrl,
      profile: C2_PROFILE,
      seed,
    },
    now,
  });
  const concurrency = telemetry?.benchmark;
  if (!concurrency) {
    throw new Error(
      'C2 telemetry run did not return its concurrency benchmark.',
    );
  }

  const statistical = synthesizeReport({
    paired,
    orderPair,
    concurrency,
    telemetry,
    seed,
    now,
  });
  const statisticalMarkdown = renderMarkdown(statistical);

  return {
    profile: C2_PROFILE,
    paired,
    orderPair,
    concurrency,
    telemetry,
    statistical,
    statisticalMarkdown,
  };
}

export async function writeC2EvidenceArtifacts(
  suite,
  { outputDir = DEFAULT_OUTPUT_DIR } = {},
) {
  const root = resolve(outputDir);
  const outputs = {
    paired: resolve(root, 'search-comparison-benchmark.json'),
    concurrency: resolve(root, 'search-comparison-concurrency.json'),
    telemetry: resolve(root, 'search-comparison-resource-telemetry.json'),
    statistical: resolve(root, 'search-comparison-statistical-report.json'),
    statisticalMarkdown: resolve(
      root,
      'search-comparison-statistical-report.md',
    ),
  };

  await Promise.all(
    Object.values(outputs).map((path) =>
      mkdir(dirname(path), { recursive: true }),
    ),
  );
  await Promise.all([
    writeFile(
      outputs.paired,
      `${JSON.stringify(suite.paired, null, 2)}\n`,
      'utf8',
    ),
    writeFile(
      outputs.concurrency,
      `${JSON.stringify(suite.concurrency, null, 2)}\n`,
      'utf8',
    ),
    writeFile(
      outputs.telemetry,
      `${JSON.stringify(suite.telemetry, null, 2)}\n`,
      'utf8',
    ),
    writeFile(
      outputs.statistical,
      `${JSON.stringify(suite.statistical, null, 2)}\n`,
      'utf8',
    ),
    writeFile(outputs.statisticalMarkdown, suite.statisticalMarkdown, 'utf8'),
  ]);
  return outputs;
}

export function parseArguments(argv) {
  const options = {
    baseUrl: DEFAULT_BASE_URL,
    solrBaseUrl: DEFAULT_SOLR_BASE_URL,
    openSearchBaseUrl: DEFAULT_OPENSEARCH_BASE_URL,
    researchReport: DEFAULT_RESEARCH_REPORT,
    outputDir: DEFAULT_OUTPUT_DIR,
    seed: DEFAULT_SEED,
    batches: DEFAULT_BATCHES,
    warmupRuns: DEFAULT_WARMUP_RUNS,
    measuredRuns: DEFAULT_MEASURED_RUNS,
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
      case '--solr-url':
        options.solrBaseUrl = value;
        index += 1;
        break;
      case '--opensearch-url':
        options.openSearchBaseUrl = value;
        index += 1;
        break;
      case '--research-report':
        options.researchReport = value;
        index += 1;
        break;
      case '--output-dir':
        options.outputDir = value;
        index += 1;
        break;
      case '--seed':
        options.seed = Number(value);
        index += 1;
        break;
      case '--batches':
        options.batches = Number(value);
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
      default:
        throw new Error(`Unknown C2 evidence-suite argument: ${argument}`);
    }
  }
  return options;
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const researchReport = JSON.parse(
    await readFile(resolve(options.researchReport), 'utf8'),
  );
  const suite = await runC2EvidenceSuite({
    researchReport,
    baseUrl: options.baseUrl,
    solrBaseUrl: options.solrBaseUrl,
    openSearchBaseUrl: options.openSearchBaseUrl,
    seed: options.seed,
    batches: options.batches,
    warmupRuns: options.warmupRuns,
    measuredRuns: options.measuredRuns,
  });
  const outputs = await writeC2EvidenceArtifacts(suite, {
    outputDir: options.outputDir,
  });

  console.log(`C2 paired evidence written to ${outputs.paired}`);
  console.log(`C2 concurrency evidence written to ${outputs.concurrency}`);
  console.log(`C2 resource telemetry written to ${outputs.telemetry}`);
  console.log(`C2 statistical JSON written to ${outputs.statistical}`);
  console.log(
    `C2 statistical Markdown written to ${outputs.statisticalMarkdown}`,
  );
  console.log(`Projection: ${suite.statistical.projection.projectionId}`);
  console.log(suite.statistical.claimGuardrail);
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
