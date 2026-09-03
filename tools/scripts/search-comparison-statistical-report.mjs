import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { nearestRankPercentile } from './search-comparison-benchmark.mjs';
import { summarizePairedLatencyEvidence } from './search-comparison-statistics.mjs';

const DEFAULT_PAIRED =
  'browser-evidence-artifacts/search-comparison-benchmark.json';
const DEFAULT_ORDER_PAIR =
  'browser-evidence-artifacts/search-comparison-100k-order-pair.json';
const DEFAULT_CONCURRENCY =
  'browser-evidence-artifacts/search-comparison-concurrency.json';
const DEFAULT_TELEMETRY =
  'browser-evidence-artifacts/search-comparison-resource-telemetry.json';
const DEFAULT_JSON_OUTPUT =
  'browser-evidence-artifacts/search-comparison-statistical-report.json';
const DEFAULT_MARKDOWN_OUTPUT =
  'browser-evidence-artifacts/search-comparison-statistical-report.md';
const DEFAULT_SEED = 20260903;

function requireProjectionId(value, label) {
  if (typeof value !== 'string' || !/^[0-9a-f]{64}$/.test(value)) {
    throw new Error(`${label} must be a lowercase SHA-256 projection ID.`);
  }
  return value;
}

function artifactProjectionId(artifact, label) {
  const projectionId =
    artifact?.projection?.projectionId ??
    artifact?.benchmark?.projection?.projectionId ??
    artifact?.evidence?.currentProjectionId ??
    null;
  return requireProjectionId(projectionId, `${label} projectionId`);
}

function requireSameProjection(artifacts) {
  const entries = Object.entries(artifacts).filter(([, artifact]) => artifact);
  if (entries.length === 0) {
    throw new Error('At least one evidence artifact is required.');
  }
  const projections = entries.map(([label, artifact]) => ({
    label,
    projectionId: artifactProjectionId(artifact, label),
  }));
  const expected = projections[0].projectionId;
  const mismatch = projections.find(
    (projection) => projection.projectionId !== expected,
  );
  if (mismatch) {
    throw new Error(
      `Evidence projection mismatch: ${mismatch.label} has ${mismatch.projectionId}, expected ${expected}.`,
    );
  }
  return { projectionId: expected, artifacts: projections };
}

function pairedWorkloadIdentity(paired) {
  const request = paired?.request;
  if (!request) {
    return null;
  }
  return {
    scenario: request.scenario ?? null,
    query: request.query ?? null,
    filters: request.filters ?? null,
  };
}

function executionControlSummary(paired) {
  const plan = paired?.executionPlan;
  if (!plan) {
    return null;
  }
  const randomized = plan.orderStrategy === 'RANDOMIZED';
  return {
    orderStrategy: plan.orderStrategy ?? null,
    requestedStartingOrder:
      plan.requestedStartingOrder ??
      paired?.requestedExecutionOrder ??
      paired?.executionOrder ??
      null,
    realizedFirstBatchOrder:
      plan.realizedFirstBatchOrder ?? paired?.executionOrder ?? null,
    seed: plan.seed ?? null,
    seedApplied: plan.seedApplied ?? (randomized && plan.seed != null),
    batches: plan.batches ?? null,
    measuredRunsPerBatch: plan.measuredRunsPerBatch ?? null,
    totalMeasuredRuns: plan.totalMeasuredRuns ?? null,
    batchExecutionOrders: Array.isArray(plan.batchExecutionOrders)
      ? [...plan.batchExecutionOrders]
      : [],
    endpoint: paired?.endpoint ?? null,
    endpointTemplate: paired?.endpointTemplate ?? null,
  };
}

function batchMedians(paired, sampleGroup) {
  const batches = paired?.batchEvidence;
  const solrSamples = paired?.rawSamples?.[sampleGroup]?.solrMs;
  const openSearchSamples = paired?.rawSamples?.[sampleGroup]?.openSearchMs;
  if (
    !Array.isArray(batches) ||
    batches.length < 2 ||
    !Array.isArray(solrSamples) ||
    !Array.isArray(openSearchSamples)
  ) {
    return null;
  }

  const solrBatchMedians = [];
  const openSearchBatchMedians = [];
  for (const batch of batches) {
    if (
      !Array.isArray(batch.sampleIndexes) ||
      batch.sampleIndexes.length === 0
    ) {
      return null;
    }
    const solr = batch.sampleIndexes.map((index) => solrSamples[index]);
    const openSearch = batch.sampleIndexes.map(
      (index) => openSearchSamples[index],
    );
    if (
      solr.some((value) => !Number.isFinite(value)) ||
      openSearch.some((value) => !Number.isFinite(value))
    ) {
      return null;
    }
    solrBatchMedians.push(nearestRankPercentile(solr, 0.5));
    openSearchBatchMedians.push(nearestRankPercentile(openSearch, 0.5));
  }
  return { solrBatchMedians, openSearchBatchMedians };
}

export function summarizeIndependentBatchEvidence(
  paired,
  { seed = DEFAULT_SEED } = {},
) {
  const workload = pairedWorkloadIdentity(paired);
  const api = batchMedians(paired, 'apiElapsed');
  const native = batchMedians(paired, 'engineReported');
  if (!api || !native) {
    return {
      available: false,
      workload,
      reason:
        'At least two batches with retained sample indexes and paired raw samples are required for batch-level inference.',
    };
  }
  return {
    available: true,
    workload,
    experimentalUnit:
      'One separately warmed benchmark batch for the identified standalone workload; each batch contributes one Solr median and one OpenSearch median.',
    batchCount: api.solrBatchMedians.length,
    apiElapsed: {
      solrBatchMediansMs: api.solrBatchMedians,
      openSearchBatchMediansMs: api.openSearchBatchMedians,
      statistics: summarizePairedLatencyEvidence(
        api.solrBatchMedians,
        api.openSearchBatchMedians,
        { seed },
      ),
    },
    engineReported: {
      solrBatchMediansMs: native.solrBatchMedians,
      openSearchBatchMediansMs: native.openSearchBatchMedians,
      statistics: summarizePairedLatencyEvidence(
        native.solrBatchMedians,
        native.openSearchBatchMedians,
        { seed },
      ),
    },
  };
}

function orderRobustnessSummary(orderPair) {
  const scenarios = orderPair?.orderRobustness;
  if (!Array.isArray(scenarios)) {
    return null;
  }
  return {
    scenarioCount: scenarios.length,
    solrLeadsP50BothOrdersCount: scenarios.filter(
      (scenario) => scenario.solrLeadsP50BothOrders,
    ).length,
    solrLeadsP95BothOrdersCount: scenarios.filter(
      (scenario) => scenario.solrLeadsP95BothOrders,
    ).length,
    scenarios: scenarios.map((scenario) => ({
      id: scenario.id,
      solrLeadsP50BothOrders: scenario.solrLeadsP50BothOrders,
      solrLeadsP95BothOrders: scenario.solrLeadsP95BothOrders,
    })),
  };
}

function concurrencyRows(concurrency) {
  if (!Array.isArray(concurrency?.workloads)) {
    return [];
  }
  return concurrency.workloads.flatMap((workload) =>
    workload.concurrencyResults.map((result) => ({
      workloadId: workload.id,
      workloadClass: workload.workloadClass,
      concurrency: result.concurrency,
      measuredComparisons: result.totalMeasuredComparisons,
      comparisonRequestsPerSecond:
        result.throughput?.comparisonRequestsPerSecond ?? null,
      solrApiP50Ms: result.summary.solr.apiElapsed.p50Ms,
      solrApiP95Ms: result.summary.solr.apiElapsed.p95Ms,
      openSearchApiP50Ms: result.summary.openSearch.apiElapsed.p50Ms,
      openSearchApiP95Ms: result.summary.openSearch.apiElapsed.p95Ms,
      medianPairedDifferenceMs:
        result.summary.pairedStatistics.apiElapsed.medianDifferenceMs,
      pairedBootstrap95PercentCiMs: [
        result.summary.pairedStatistics.apiElapsed.bootstrap.lowerMs,
        result.summary.pairedStatistics.apiElapsed.bootstrap.upperMs,
      ],
      solrWinRatePercent:
        result.summary.pairedStatistics.apiElapsed.solrWinRatePercent,
    })),
  );
}

function batchSummaryMedians(batchEvidence, metricGroup) {
  if (!Array.isArray(batchEvidence) || batchEvidence.length < 2) {
    return null;
  }
  const solrBatchMedians = batchEvidence.map(
    (batch) => batch?.summary?.solr?.[metricGroup]?.p50Ms,
  );
  const openSearchBatchMedians = batchEvidence.map(
    (batch) => batch?.summary?.openSearch?.[metricGroup]?.p50Ms,
  );
  if (
    solrBatchMedians.some((value) => !Number.isFinite(value)) ||
    openSearchBatchMedians.some((value) => !Number.isFinite(value))
  ) {
    return null;
  }
  return { solrBatchMedians, openSearchBatchMedians };
}

export function summarizeConcurrencyBatchEvidence(
  concurrency,
  { seed = DEFAULT_SEED } = {},
) {
  if (!Array.isArray(concurrency?.workloads)) {
    return [];
  }

  let analysisIndex = 0;
  return concurrency.workloads.flatMap((workload) =>
    workload.concurrencyResults.map((result) => {
      const rowSeed = seed + analysisIndex;
      analysisIndex += 1;
      const api = batchSummaryMedians(result.batchEvidence, 'apiElapsed');
      const native = batchSummaryMedians(
        result.batchEvidence,
        'engineReported',
      );
      if (!api || !native) {
        return {
          workloadId: workload.id,
          workloadClass: workload.workloadClass,
          concurrency: result.concurrency,
          available: false,
          reason:
            'At least two separately warmed concurrency batches with retained per-engine p50 summaries are required.',
        };
      }

      return {
        workloadId: workload.id,
        workloadClass: workload.workloadClass,
        concurrency: result.concurrency,
        available: true,
        experimentalUnit:
          'One separately warmed concurrency batch for this workload/client level; each batch contributes one Solr p50 and one OpenSearch p50.',
        batchCount: api.solrBatchMedians.length,
        apiElapsed: {
          solrBatchMediansMs: api.solrBatchMedians,
          openSearchBatchMediansMs: api.openSearchBatchMedians,
          statistics: summarizePairedLatencyEvidence(
            api.solrBatchMedians,
            api.openSearchBatchMedians,
            { seed: rowSeed },
          ),
        },
        engineReported: {
          solrBatchMediansMs: native.solrBatchMedians,
          openSearchBatchMediansMs: native.openSearchBatchMedians,
          statistics: summarizePairedLatencyEvidence(
            native.solrBatchMedians,
            native.openSearchBatchMedians,
            { seed: rowSeed },
          ),
        },
      };
    }),
  );
}

function telemetrySummary(telemetry) {
  const delta = telemetry?.resourceTelemetry?.delta;
  if (!delta) {
    return null;
  }
  return {
    interpretation: delta.interpretation,
    counterResetDetected: delta.counterResetDetected ?? false,
    counterResetFields: delta.counterResetFields ?? [],
    openSearch: delta.openSearch,
    solr: {
      garbageCollectionMetricDeltas:
        delta.solr?.garbageCollectionMetricDeltas ?? {},
      beforeGarbageCollectionMetrics:
        delta.solr?.beforeGarbageCollectionMetrics ?? {},
      afterGarbageCollectionMetrics:
        delta.solr?.afterGarbageCollectionMetrics ?? {},
      cpuTimeMetricDeltas: delta.solr?.cpuTimeMetricDeltas ?? {},
      beforeCpuAndLoadMetrics: delta.solr?.beforeCpuAndLoadMetrics ?? {},
      afterCpuAndLoadMetrics: delta.solr?.afterCpuAndLoadMetrics ?? {},
      beforeHeapAndMemoryMetrics: delta.solr?.beforeHeapAndMemoryMetrics ?? {},
      afterHeapAndMemoryMetrics: delta.solr?.afterHeapAndMemoryMetrics ?? {},
    },
    docker: delta.docker ?? {},
  };
}

function baselineRequestEvidence(paired) {
  const statistics = paired?.pairedStatistics;
  if (!statistics) {
    return null;
  }
  return {
    workload: pairedWorkloadIdentity(paired),
    experimentalUnit:
      'One paired comparison request for the identified standalone workload. Requests inside the same batch share warm/cache conditions, so this is descriptive request-level evidence rather than the highest-level repeated experimental unit.',
    apiElapsed: statistics.apiElapsed,
    engineReported: statistics.engineReported,
  };
}

export function synthesizeStatisticalReport({
  paired,
  orderPair,
  concurrency,
  telemetry,
  seed = DEFAULT_SEED,
  now = () => new Date(),
} = {}) {
  const projection = requireSameProjection({
    paired,
    orderPair,
    concurrency,
    telemetry,
  });
  const batchEvidence = paired
    ? summarizeIndependentBatchEvidence(paired, { seed })
    : null;
  const executionControls = executionControlSummary(paired);
  const orderRobustness = orderRobustnessSummary(orderPair);
  const concurrencyEvidence = concurrencyRows(concurrency);
  const concurrencyBatchEvidence = summarizeConcurrencyBatchEvidence(
    concurrency,
    { seed },
  );
  const resources = telemetrySummary(telemetry);

  return {
    kind: 'search-comparison-statistical-research-report',
    capturedAt: now().toISOString(),
    scope: 'LOCAL_CERTIFIED_TOPOLOGY_ONLY',
    comparativeClaimAllowed: false,
    projection,
    claimGuardrail:
      'This report may support scoped statements about the documented corpus, mappings, workload/client cells, engine versions and local/container topology. It must not be summarized as proof that Solr or OpenSearch is universally faster or more resource-efficient, and the per-cell confidence intervals are not a multiplicity-adjusted family-wide significance test.',
    methodologyHierarchy: [
      'Request-level paired statistics describe within-request latency differences.',
      'Separately warmed batch medians are the preferred repeated experimental unit when two or more batches are present.',
      'The standalone paired benchmark is workload-scoped; its scenario/query identity is retained with its request- and batch-level inference.',
      'Requested starting order, realized first-batch order, effective randomized seed and full batch execution plan are retained from the paired benchmark artifact.',
      'Concurrency batches provide independent-batch inference separately for every workload and client level in the 4 x 3 matrix.',
      'Per-cell 95% confidence intervals are not multiplicity-adjusted; the report makes no family-wide significance claim across the workload/concurrency matrix.',
      'Reversed/randomized engine-first order tests ordering sensitivity.',
      'The workload matrix tests full text, facets, broad filtering and selective filtering.',
      'Concurrency evidence separates latency from achieved throughput at the paired comparison-request boundary.',
      'Resource telemetry distinguishes cumulative counter deltas from instantaneous CPU/load, heap and container-memory observations and surfaces counter resets.',
    ],
    executionControlEvidence: executionControls,
    requestLevelEvidence: baselineRequestEvidence(paired),
    batchLevelEvidence: batchEvidence,
    orderRobustness,
    concurrencyEvidence,
    concurrencyBatchEvidence,
    resourceEvidence: resources,
  };
}

function format(value) {
  return value === null || value === undefined ? 'n/a' : String(value);
}

function ci(statistics) {
  if (!statistics?.bootstrap) {
    return 'n/a';
  }
  return `${statistics.bootstrap.lowerMs} .. ${statistics.bootstrap.upperMs}`;
}

function workloadLabel(workload) {
  if (!workload) {
    return 'unspecified standalone workload';
  }
  const query = workload.query
    ? `; query=${JSON.stringify(workload.query)}`
    : '';
  return `${workload.scenario ?? 'unspecified scenario'}${query}`;
}

export function renderStatisticalMarkdown(report) {
  const batch = report.batchLevelEvidence;
  const batchText = batch?.available
    ? `Workload: **${workloadLabel(batch.workload)}**\n\nBatch count: **${batch.batchCount}**\n\n- API median paired difference (OpenSearch - Solr): **${batch.apiElapsed.statistics.medianDifferenceMs} ms**, 95% bootstrap CI **${ci(batch.apiElapsed.statistics)} ms**, Solr win rate **${batch.apiElapsed.statistics.solrWinRatePercent}%**.\n- Native-timing median paired difference: **${batch.engineReported.statistics.medianDifferenceMs} ms**, 95% bootstrap CI **${ci(batch.engineReported.statistics)} ms**.`
    : `Batch-level inference unavailable for ${workloadLabel(batch?.workload)}: ${batch?.reason ?? 'no paired batch artifact supplied'}`;

  const execution = report.executionControlEvidence;
  const executionText = execution
    ? `- Order strategy: **${format(execution.orderStrategy)}**\n- Requested starting order: **${format(execution.requestedStartingOrder)}**\n- Realized first batch order: **${format(execution.realizedFirstBatchOrder)}**\n- Randomized seed applied: **${format(execution.seedApplied)}**\n- Effective seed: **${execution.seedApplied ? format(execution.seed) : 'n/a'}**\n- Batch plan: **${execution.batchExecutionOrders.length ? execution.batchExecutionOrders.join(' → ') : 'n/a'}**\n- Measured runs: **${format(execution.totalMeasuredRuns)}** across **${format(execution.batches)}** batches.`
    : 'Paired benchmark execution-plan metadata was not supplied.';

  const orderRows = report.orderRobustness?.scenarios?.length
    ? report.orderRobustness.scenarios
        .map(
          (scenario) =>
            `| ${scenario.id} | ${scenario.solrLeadsP50BothOrders} | ${scenario.solrLeadsP95BothOrders} |`,
        )
        .join('\n')
    : '| n/a | n/a | n/a |';

  const concurrencyRowsMarkdown = report.concurrencyEvidence.length
    ? report.concurrencyEvidence
        .map(
          (row) =>
            `| ${row.workloadId} | ${row.workloadClass} | ${row.concurrency} | ${format(row.comparisonRequestsPerSecond)} | ${row.solrApiP50Ms} / ${row.solrApiP95Ms} | ${row.openSearchApiP50Ms} / ${row.openSearchApiP95Ms} | ${row.medianPairedDifferenceMs} | ${row.pairedBootstrap95PercentCiMs[0]} .. ${row.pairedBootstrap95PercentCiMs[1]} |`,
        )
        .join('\n')
    : '| n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a |';

  const concurrencyBatchRows = report.concurrencyBatchEvidence.length
    ? report.concurrencyBatchEvidence
        .map((row) => {
          if (!row.available) {
            return `| ${row.workloadId} | ${row.workloadClass} | ${row.concurrency} | n/a | n/a | n/a | n/a |`;
          }
          return `| ${row.workloadId} | ${row.workloadClass} | ${row.concurrency} | ${row.batchCount} | ${row.apiElapsed.statistics.medianDifferenceMs} | ${ci(row.apiElapsed.statistics)} | ${row.apiElapsed.statistics.solrWinRatePercent}% |`;
        })
        .join('\n')
    : '| n/a | n/a | n/a | n/a | n/a | n/a | n/a |';

  const resources = report.resourceEvidence;
  const openSearch = resources?.openSearch;
  const resetFields = resources?.counterResetFields ?? [];
  const docker = resources?.docker ?? {};
  const dockerRows = Object.keys(docker).length
    ? Object.entries(docker)
        .map(
          ([service, evidence]) =>
            `| ${service} | ${format(evidence.memoryUsedBytesDelta)} | ${format(evidence.beforeCpuPercent)} | ${format(evidence.afterCpuPercent)} | ${format(evidence.beforeMemoryPercent)} | ${format(evidence.afterMemoryPercent)} |`,
        )
        .join('\n')
    : '| n/a | n/a | n/a | n/a | n/a | n/a |';

  return `# Solr vs OpenSearch Statistical Research Report

Captured: ${report.capturedAt}

Projection: \`${report.projection.projectionId}\`

Scope: **${report.scope}**

> ${report.claimGuardrail}

## Evidence hierarchy

${report.methodologyHierarchy.map((item) => `- ${item}`).join('\n')}

## Paired benchmark execution controls

${executionText}

## Standalone independent batch evidence

${batchText}

## Execution-order robustness

| Workload | Solr p50 lead in both orders | Solr p95 lead in both orders |
| --- | ---: | ---: |
${orderRows}

## Concurrency matrix

| Workload | Class | Clients | Paired requests/sec | Solr API p50 / p95 | OpenSearch API p50 / p95 | Median paired difference ms | 95% request-pair CI ms |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
${concurrencyRowsMarkdown}

## Independent batch evidence by workload and concurrency

Each row below treats one separately warmed concurrency batch as the repeated experimental unit for that exact workload/client level. These per-cell intervals are not multiplicity-adjusted and do not constitute a family-wide significance test.

| Workload | Class | Clients | Batches | API median paired difference ms | 95% batch CI ms | Solr batch win rate |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
${concurrencyBatchRows}

## Resource evidence

Counter reset detected: **${format(resources?.counterResetDetected)}**  
Counter reset fields: **${resetFields.length ? resetFields.join(', ') : 'none'}**  
OpenSearch process CPU-time delta: **${format(openSearch?.processCpuTotalMillisDelta)} ms**  
OpenSearch GC collection-count delta: **${format(openSearch?.gcCollectionCountDelta)}**  
OpenSearch GC collection-time delta: **${format(openSearch?.gcCollectionTimeMillisDelta)} ms**  
OpenSearch search-query delta: **${format(openSearch?.searchQueryTotalDelta)}**

### Container observations

| Service | Memory used delta bytes | CPU before % | CPU after % | Memory before % | Memory after % |
| --- | ---: | ---: | ---: | ---: | ---: |
${dockerRows}

Solr cumulative GC count/time and CPU-time deltas are preserved under their Solr metric keys in the JSON report. Solr CPU/load, heap and memory gauges remain explicit before/after observations rather than being silently converted into cumulative work or renamed to OpenSearch field semantics.

## Interpretation boundary

The scientifically defensible conclusion is about this exact corpus/projection, mappings, workload definitions, engine-first order controls, concurrency levels and local/container topology. A per-cell confidence interval excluding zero supports a difference for that measured experimental unit; it does **not** establish universal search-engine superiority or a multiplicity-adjusted family-wide result.
`;
}

async function readJson(path) {
  return JSON.parse(await readFile(resolve(path), 'utf8'));
}

export function parseArguments(argv) {
  const options = {
    paired: DEFAULT_PAIRED,
    orderPair: DEFAULT_ORDER_PAIR,
    concurrency: DEFAULT_CONCURRENCY,
    telemetry: DEFAULT_TELEMETRY,
    jsonOutput: DEFAULT_JSON_OUTPUT,
    markdownOutput: DEFAULT_MARKDOWN_OUTPUT,
    seed: DEFAULT_SEED,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const value = argv[index + 1];
    switch (argument) {
      case '--':
        break;
      case '--paired':
        options.paired = value;
        index += 1;
        break;
      case '--order-pair':
        options.orderPair = value;
        index += 1;
        break;
      case '--concurrency':
        options.concurrency = value;
        index += 1;
        break;
      case '--telemetry':
        options.telemetry = value;
        index += 1;
        break;
      case '--json-output':
        options.jsonOutput = value;
        index += 1;
        break;
      case '--markdown-output':
        options.markdownOutput = value;
        index += 1;
        break;
      case '--seed':
        options.seed = Number(value);
        index += 1;
        break;
      default:
        throw new Error(`Unknown statistical report argument: ${argument}`);
    }
  }
  return options;
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const [paired, orderPair, concurrency, telemetry] = await Promise.all([
    readJson(options.paired),
    readJson(options.orderPair),
    readJson(options.concurrency),
    readJson(options.telemetry),
  ]);
  const report = synthesizeStatisticalReport({
    paired,
    orderPair,
    concurrency,
    telemetry,
    seed: options.seed,
  });
  const markdown = renderStatisticalMarkdown(report);
  const jsonPath = resolve(options.jsonOutput);
  const markdownPath = resolve(options.markdownOutput);
  await mkdir(dirname(jsonPath), { recursive: true });
  await mkdir(dirname(markdownPath), { recursive: true });
  await Promise.all([
    writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8'),
    writeFile(markdownPath, markdown, 'utf8'),
  ]);
  console.log(`Statistical JSON report written to ${jsonPath}`);
  console.log(`Statistical Markdown report written to ${markdownPath}`);
  console.log(report.claimGuardrail);
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
