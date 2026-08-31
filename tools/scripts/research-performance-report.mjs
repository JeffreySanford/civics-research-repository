import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  adaptiveScenarios,
  discoverSelectiveProgram,
} from './search-comparison-100k-adaptive.mjs';
import {
  runHundredKSearchComparisonMatrix,
  summarizeHostContext,
} from './search-comparison-100k-matrix.mjs';
import { runOpenSearchAggregationShapeDiagnostic } from './opensearch-aggregation-shape-diagnostic.mjs';

const DEFAULT_BASE_URL = 'http://localhost:8080/api';
const DEFAULT_PROFILE = 'FEDERATED_100K';
const DEFAULT_OUTPUT_DIR = 'browser-evidence-artifacts/research-performance';
const SUPPORTED_PROFILES = new Set(['FEDERATED_100K', 'FEDERATED_1M']);

function requireBoundedInteger(value, label, minimum, maximum) {
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error(
      `${label} must be an integer from ${minimum} to ${maximum}.`,
    );
  }
  return value;
}

function requireProfile(value) {
  if (!SUPPORTED_PROFILES.has(value)) {
    throw new Error(
      `profile must be one of ${[...SUPPORTED_PROFILES].join(', ')}.`,
    );
  }
  return value;
}

async function fetchJson(fetchImpl, url, init) {
  const response = await fetchImpl(url, init);
  if (!response.ok) {
    throw new Error(`Request failed with HTTP ${response.status}: ${url}`);
  }
  return response.json();
}

async function fetchScaleEvidence(fetchImpl, baseUrl, profile) {
  const endpoint = `${baseUrl.replace(/\/$/, '')}/admin/corpus/scale/evidence?profile=${encodeURIComponent(profile)}`;
  const evidence = await fetchJson(fetchImpl, endpoint);
  if (!evidence?.valid) {
    const violations = Array.isArray(evidence?.violations)
      ? evidence.violations.join(' | ')
      : 'unknown evidence violation';
    throw new Error(`${profile} evidence is not valid: ${violations}`);
  }
  if (evidence.activeProfile !== profile) {
    throw new Error(
      `${profile} must be the active profile before the research report runs.`,
    );
  }
  if (!evidence.targetParity) {
    throw new Error(`${profile} evidence reports target parity false.`);
  }
  return evidence;
}

function selectiveFilter(program, projectedCount) {
  return {
    field: 'program',
    value: program.value,
    matchingDocuments: program.count,
    selectivityPercent:
      Math.round((program.count / projectedCount) * 10000) / 100,
  };
}

function orderRobustness(solrFirst, openSearchFirst) {
  return solrFirst.scenarios.map((firstScenario) => {
    const reversedScenario = openSearchFirst.scenarios.find(
      (scenario) => scenario.id === firstScenario.id,
    );
    if (!reversedScenario) {
      throw new Error(
        `Missing reversed-order result for scenario ${firstScenario.id}.`,
      );
    }
    return {
      id: firstScenario.id,
      solrLeadsApiP50BothOrders:
        firstScenario.solr.elapsed.p50Ms <
          firstScenario.openSearch.elapsed.p50Ms &&
        reversedScenario.solr.elapsed.p50Ms <
          reversedScenario.openSearch.elapsed.p50Ms,
      solrLeadsApiP95BothOrders:
        firstScenario.solr.elapsed.p95Ms <
          firstScenario.openSearch.elapsed.p95Ms &&
        reversedScenario.solr.elapsed.p95Ms <
          reversedScenario.openSearch.elapsed.p95Ms,
      solrLeadsNativeP50BothOrders:
        firstScenario.solr.engineReported.p50Ms <
          firstScenario.openSearch.engineReported.p50Ms &&
        reversedScenario.solr.engineReported.p50Ms <
          reversedScenario.openSearch.engineReported.p50Ms,
      solrLeadsNativeP95BothOrders:
        firstScenario.solr.engineReported.p95Ms <
          firstScenario.openSearch.engineReported.p95Ms &&
        reversedScenario.solr.engineReported.p95Ms <
          reversedScenario.openSearch.engineReported.p95Ms,
    };
  });
}

export async function runPairedProfileBenchmark({
  fetchImpl = globalThis.fetch,
  baseUrl = DEFAULT_BASE_URL,
  profile = DEFAULT_PROFILE,
  warmupRuns = 5,
  measuredRuns = 100,
  now = () => new Date(),
  hostContext = summarizeHostContext(),
} = {}) {
  requireProfile(profile);
  requireBoundedInteger(warmupRuns, 'warmupRuns', 0, 20);
  requireBoundedInteger(measuredRuns, 'measuredRuns', 1, 100);

  const evidence = await fetchScaleEvidence(fetchImpl, baseUrl, profile);
  const selectedProgram = await discoverSelectiveProgram({ fetchImpl, baseUrl });
  const scenarios = adaptiveScenarios(selectedProgram);

  const solrFirst = await runHundredKSearchComparisonMatrix({
    fetchImpl,
    baseUrl,
    profile,
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
    profile,
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
      'Projection changed between paired execution-order benchmark passes.',
    );
  }
  if (
    openSearchFirst.evidence.currentProjectionObjectCount !==
    solrFirst.evidence.currentProjectionObjectCount
  ) {
    throw new Error(
      'Projection document count changed between paired execution-order benchmark passes.',
    );
  }

  return {
    profile,
    capturedAt: now().toISOString(),
    evidence,
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
    passes: {
      SOLR_FIRST: solrFirst,
      OPENSEARCH_FIRST: openSearchFirst,
    },
    orderRobustness: orderRobustness(solrFirst, openSearchFirst),
  };
}

function ratioPercent(before, after) {
  if (!Number.isFinite(before) || before <= 0 || !Number.isFinite(after)) {
    return null;
  }
  return Math.round(((before - after) / before) * 10000) / 100;
}

function timingRows(pass) {
  return pass.scenarios
    .map(
      (scenario) =>
        `| ${scenario.id} | ${scenario.solr.elapsed.p50Ms} / ${scenario.solr.elapsed.p95Ms} / ${scenario.solr.elapsed.p99Ms} | ${scenario.openSearch.elapsed.p50Ms} / ${scenario.openSearch.elapsed.p95Ms} / ${scenario.openSearch.elapsed.p99Ms} | ${scenario.solr.engineReported.p50Ms} / ${scenario.solr.engineReported.p95Ms} / ${scenario.solr.engineReported.p99Ms} | ${scenario.openSearch.engineReported.p50Ms} / ${scenario.openSearch.engineReported.p95Ms} / ${scenario.openSearch.engineReported.p99Ms} |`,
    )
    .join('\n');
}

function aggregationRows(aggregationDiagnostic) {
  if (!aggregationDiagnostic) {
    return 'Aggregation-shape diagnostics are planned for this scale but were not executed in this report.';
  }

  const unfiltered = aggregationDiagnostic.experiments.unfilteredDirectTerms;
  const selective =
    aggregationDiagnostic.experiments.selectiveSharedFilterScope;
  const unfilteredP50 = ratioPercent(
    unfiltered.baseline.took.p50Ms,
    unfiltered.candidate.took.p50Ms,
  );
  const unfilteredP95 = ratioPercent(
    unfiltered.baseline.took.p95Ms,
    unfiltered.candidate.took.p95Ms,
  );
  const selectiveP50 = ratioPercent(
    selective.baseline.took.p50Ms,
    selective.candidate.took.p50Ms,
  );
  const selectiveP95 = ratioPercent(
    selective.baseline.took.p95Ms,
    selective.candidate.took.p95Ms,
  );

  return `| Experiment | Current took p50 / p95 / p99 | Candidate took p50 / p95 / p99 | Native p50 change | Native p95 change |
| --- | ---: | ---: | ---: | ---: |
| Unfiltered: scoped match-all → direct terms | ${unfiltered.baseline.took.p50Ms} / ${unfiltered.baseline.took.p95Ms} / ${unfiltered.baseline.took.p99Ms} | ${unfiltered.candidate.took.p50Ms} / ${unfiltered.candidate.took.p95Ms} / ${unfiltered.candidate.took.p99Ms} | ${unfilteredP50}% | ${unfilteredP95}% |
| Selective: duplicated scopes → shared scope | ${selective.baseline.took.p50Ms} / ${selective.baseline.took.p95Ms} / ${selective.baseline.took.p99Ms} | ${selective.candidate.took.p50Ms} / ${selective.candidate.took.p95Ms} / ${selective.candidate.took.p99Ms} | ${selectiveP50}% | ${selectiveP95}% |`;
}

function scalePlan(profile) {
  if (profile === 'FEDERATED_1M') {
    return 'This run is the 1M scale execution. Results should be compared with the 100K report using the same scenario definitions, warmup/sample policy, semantic-parity gates, and paired execution orders.';
  }
  return 'The 1M phase uses this same runner with `--profile FEDERATED_1M`. It must not run until the 1M corpus is retained, projected, parity-verified, and exposed by a valid scale-evidence report. The 1M run keeps the same scenarios and paired execution orders so scale, rather than methodology drift, is the independent variable.';
}

export function renderResearchMarkdown(result) {
  const paired = result.paired;
  const evidence = paired.evidence;
  const robustness = paired.orderRobustness
    .map(
      (scenario) =>
        `| ${scenario.id} | ${scenario.solrLeadsApiP50BothOrders} | ${scenario.solrLeadsApiP95BothOrders} | ${scenario.solrLeadsNativeP50BothOrders} | ${scenario.solrLeadsNativeP95BothOrders} |`,
    )
    .join('\n');

  return `# Search Research Report — ${paired.profile}

Captured: ${result.capturedAt}

## Research status

- Profile: \`${paired.profile}\`
- Projection objects: **${paired.projection.objectCount.toLocaleString('en-US')}**
- Projection ID: \`${paired.projection.projectionId}\`
- Retained federated records: **${Number(evidence.retainedFederatedRecordCount).toLocaleString('en-US')}**
- Target parity: **${evidence.targetParity}**
- Storage evidence present: **${evidence.storageEvidencePresent}**
- Warmups per scenario/order: **${paired.warmupRuns}**
- Measured samples per scenario/order: **${paired.measuredRuns}**
- Selective program: ${paired.selectedFilter.value}
- Selective match count: **${paired.selectedFilter.matchingDocuments.toLocaleString('en-US')} (${paired.selectedFilter.selectivityPercent}%)**

## Methodology

The report treats the repository as a research system rather than a production SLO test. Solr and OpenSearch are measured against the same deterministic projection and the same normalized scenarios. Each scenario is run in both engine execution orders. Application-boundary elapsed time and engine-native Solr QTime / OpenSearch took are retained separately. Native vendor timings are diagnostic and are not treated as perfectly equivalent definitions.

Semantic correctness is a prerequisite for performance evidence. Projection identity, target parity, total hits, and facet bucket counts must agree before comparative timing is retained.

## Host context

- Logical CPUs: ${paired.hostContext.logicalCpuCount}
- Memory bytes: ${paired.hostContext.totalMemoryBytes}
- Platform: ${paired.hostContext.platform}
- Architecture: ${paired.hostContext.architecture}

## Paired search results

### SOLR_FIRST

| Scenario | Solr API p50 / p95 / p99 ms | OpenSearch API p50 / p95 / p99 ms | Solr QTime p50 / p95 / p99 ms | OpenSearch took p50 / p95 / p99 ms |
| --- | ---: | ---: | ---: | ---: |
${timingRows(paired.passes.SOLR_FIRST)}

### OPENSEARCH_FIRST

| Scenario | Solr API p50 / p95 / p99 ms | OpenSearch API p50 / p95 / p99 ms | Solr QTime p50 / p95 / p99 ms | OpenSearch took p50 / p95 / p99 ms |
| --- | ---: | ---: | ---: | ---: |
${timingRows(paired.passes.OPENSEARCH_FIRST)}

## Order robustness

| Scenario | Solr API p50 lead both orders | Solr API p95 lead both orders | Solr native p50 lead both orders | Solr native p95 lead both orders |
| --- | --- | --- | --- | --- |
${robustness}

These booleans describe this local research configuration only. They are not a universal engine ranking.

## OpenSearch aggregation-shape research

${aggregationRows(result.aggregationDiagnostic)}

Candidate aggregation timings are retained only after total hits and all facet bucket counts match the current shape for every measured pair. Application elapsed and OpenSearch native \`took\` should both remain in the evidence because short local runs can show transport/runtime noise even when native execution improves.

## 1M scale plan

${scalePlan(paired.profile)}

For 1M, record the same evidence fields plus activation duration, retained-record count, projection ID, Solr/OpenSearch index counts, storage footprint, host/container resource context, and any failures or warnings encountered during projection. Do not compare 100K and 1M if the query scenarios or projection semantics changed between runs.

## Interpretation guardrails

- This is a local single-topology research result, not a production capacity claim.
- Search-engine derived indexes are disposable projections; DSpace and external publishers remain authoritative according to repository architecture.
- Performance and semantic quality are separate evidence dimensions.
- A faster candidate is rejected if result semantics drift.
- Solr QTime and OpenSearch took are retained as native diagnostics but have different vendor definitions.
- 1M evidence should extend the scale curve; it should not replace the reproducible 100K baseline.
`;
}

export async function runResearchPerformanceReport({
  fetchImpl = globalThis.fetch,
  baseUrl = DEFAULT_BASE_URL,
  profile = DEFAULT_PROFILE,
  warmupRuns = 5,
  measuredRuns = 100,
  aggregationWarmupRuns = 3,
  aggregationMeasuredRuns = 20,
  includeAggregationDiagnostic = true,
  now = () => new Date(),
  hostContext = summarizeHostContext(),
} = {}) {
  requireProfile(profile);
  const paired = await runPairedProfileBenchmark({
    fetchImpl,
    baseUrl,
    profile,
    warmupRuns,
    measuredRuns,
    now,
    hostContext,
  });

  let aggregationDiagnostic = null;
  if (includeAggregationDiagnostic && profile === 'FEDERATED_100K') {
    aggregationDiagnostic = await runOpenSearchAggregationShapeDiagnostic({
      fetchImpl,
      apiBaseUrl: baseUrl,
      warmupRuns: aggregationWarmupRuns,
      measuredRuns: aggregationMeasuredRuns,
      now,
    });
  }

  const result = {
    kind: 'civics-research-search-performance-report',
    capturedAt: now().toISOString(),
    paired,
    aggregationDiagnostic,
  };
  return { ...result, markdown: renderResearchMarkdown(result) };
}

export function parseArguments(argv) {
  const options = {
    baseUrl: DEFAULT_BASE_URL,
    profile: DEFAULT_PROFILE,
    warmupRuns: 5,
    measuredRuns: 100,
    aggregationWarmupRuns: 3,
    aggregationMeasuredRuns: 20,
    outputDir: DEFAULT_OUTPUT_DIR,
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
      case '--warmups':
        options.warmupRuns = Number(value);
        index += 1;
        break;
      case '--samples':
        options.measuredRuns = Number(value);
        index += 1;
        break;
      case '--aggregation-warmups':
        options.aggregationWarmupRuns = Number(value);
        index += 1;
        break;
      case '--aggregation-samples':
        options.aggregationMeasuredRuns = Number(value);
        index += 1;
        break;
      case '--output-dir':
        options.outputDir = value;
        index += 1;
        break;
      default:
        throw new Error(`Unknown research report argument: ${argument}`);
    }
  }
  return options;
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const result = await runResearchPerformanceReport({
    baseUrl: options.baseUrl,
    profile: options.profile,
    warmupRuns: options.warmupRuns,
    measuredRuns: options.measuredRuns,
    aggregationWarmupRuns: options.aggregationWarmupRuns,
    aggregationMeasuredRuns: options.aggregationMeasuredRuns,
  });

  const outputDir = resolve(options.outputDir);
  await mkdir(outputDir, { recursive: true });
  const stem = options.profile.toLowerCase().replaceAll('_', '-');
  const jsonPath = resolve(outputDir, `${stem}-report.json`);
  const markdownPath = resolve(outputDir, `${stem}-report.md`);
  const jsonResult = { ...result };
  delete jsonResult.markdown;
  await writeFile(jsonPath, `${JSON.stringify(jsonResult, null, 2)}\n`, 'utf8');
  await writeFile(markdownPath, result.markdown, 'utf8');

  console.log(`Research JSON report written to ${jsonPath}`);
  console.log(`Research Markdown report written to ${markdownPath}`);
  console.log(result.markdown);
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
