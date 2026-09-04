import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { nearestRankPercentile } from './search-comparison-benchmark.mjs';
import {
  C2_1_BATCHES_PER_BLOCK,
  C2_1_RESTART_BLOCKS,
  C2_1_ROOT_SEED,
  C2_1_SELECTIVITY_BANDS,
} from './search-comparison-c2-1-foundation.mjs';
import { C2_1_EXPECTED } from './search-comparison-c2-1-manifest.mjs';
import { C2_1_ADMITTED_TREATMENT } from './search-comparison-c2-1-semantic-admission.mjs';
import { summarizePairedLatencyEvidence } from './search-comparison-statistics.mjs';

const DEFAULT_MEASUREMENT =
  'browser-evidence-artifacts/c2-1/measurement-suite.json';
const DEFAULT_SEMANTIC =
  'browser-evidence-artifacts/c2-1/semantic-admission.json';
const DEFAULT_JSON_OUTPUT =
  'browser-evidence-artifacts/c2-1/statistical-report.json';
const DEFAULT_MARKDOWN_OUTPUT =
  'browser-evidence-artifacts/c2-1/statistical-report.md';
const EXPECTED_BATCH_UNITS = C2_1_RESTART_BLOCKS * C2_1_BATCHES_PER_BLOCK;

function requireAcceptedSuite(suite) {
  if (suite?.experiment !== 'C2.1_ADVERSARIAL_STANDALONE') {
    throw new Error('C2.1 report requires the adversarial standalone experiment.');
  }
  if (suite?.kind !== 'measurement-suite' || suite?.acceptedC21Evidence !== true) {
    throw new Error('C2.1 report requires an accepted measurement-suite artifact.');
  }
  if (suite?.comparativeClaimAllowed !== false) {
    throw new Error('C2.1 report requires the comparative-claim guardrail.');
  }
  if (suite?.semanticAdmissionTimingExcluded !== true) {
    throw new Error('C2.1 report requires semantic-admission timing exclusion.');
  }
  if (suite?.projectionId !== C2_1_EXPECTED.projectionId) {
    throw new Error('C2.1 report refuses projection drift.');
  }
  if (Number(suite?.projectionObjectCount) !== C2_1_EXPECTED.projectionObjectCount) {
    throw new Error('C2.1 report requires exactly 1,000,181 projected objects.');
  }
  if (suite?.openSearchTreatment !== C2_1_ADMITTED_TREATMENT) {
    throw new Error(`C2.1 report requires ${C2_1_ADMITTED_TREATMENT}.`);
  }
  if (!Array.isArray(suite?.restartBlocks) || suite.restartBlocks.length !== C2_1_RESTART_BLOCKS) {
    throw new Error(`C2.1 report requires exactly ${C2_1_RESTART_BLOCKS} restart blocks.`);
  }
  if (!Array.isArray(suite?.workloadMatrix) || suite.workloadMatrix.length < 21) {
    throw new Error('C2.1 report requires Q01-Q20 plus corpus-wide facets.');
  }
  return suite;
}

function requireSemanticAdmission(semantic) {
  if (semantic?.experiment !== 'C2.1_ADVERSARIAL_STANDALONE' || semantic?.admitted !== true) {
    throw new Error('C2.1 report requires an admitted semantic-treatment artifact.');
  }
  if (semantic?.timingDiscarded !== true || semantic?.timingEvidenceAdmitted !== false) {
    throw new Error('C2.1 report requires semantic timings to remain discarded.');
  }
  if (semantic?.projectionId !== C2_1_EXPECTED.projectionId) {
    throw new Error('C2.1 semantic admission projection does not match the certified projection.');
  }
  if (Number(semantic?.projectionObjectCount) !== C2_1_EXPECTED.projectionObjectCount) {
    throw new Error('C2.1 semantic admission object count does not match the certified projection.');
  }
  if (semantic?.admittedTreatment !== C2_1_ADMITTED_TREATMENT) {
    throw new Error('C2.1 semantic admission treatment does not match the measured treatment.');
  }
  return semantic;
}

function requireSamples(benchmark, group) {
  const solr = benchmark?.rawSamples?.[group]?.solrMs;
  const openSearch = benchmark?.rawSamples?.[group]?.openSearchMs;
  if (!Array.isArray(solr) || !Array.isArray(openSearch) || solr.length === 0 || solr.length !== openSearch.length) {
    throw new Error(`${group} requires same-length non-empty paired raw samples.`);
  }
  if (solr.some((value) => !Number.isFinite(value)) || openSearch.some((value) => !Number.isFinite(value))) {
    throw new Error(`${group} contains a non-finite timing sample.`);
  }
  return { solr, openSearch };
}

function summarizeSamples(values) {
  return {
    sampleCount: values.length,
    p50Ms: nearestRankPercentile(values, 0.5),
    p90Ms: nearestRankPercentile(values, 0.9),
    p95Ms: nearestRankPercentile(values, 0.95),
    p99Ms: nearestRankPercentile(values, 0.99),
  };
}

function descriptivePair(solr, openSearch) {
  const differences = solr.map((value, index) => openSearch[index] - value);
  const solrWins = differences.filter((value) => value > 0).length;
  const openSearchWins = differences.filter((value) => value < 0).length;
  const ties = differences.filter((value) => value === 0).length;
  return {
    experimentalUnit:
      'One paired comparison request. These observations are descriptive because requests within a warmed batch share cache/JVM conditions.',
    pairCount: differences.length,
    solr: summarizeSamples(solr),
    openSearch: summarizeSamples(openSearch),
    medianPairedDifferenceMs: nearestRankPercentile(differences, 0.5),
    solrWinRatePercent: Math.round((solrWins / differences.length) * 10000) / 100,
    openSearchWinRatePercent:
      Math.round((openSearchWins / differences.length) * 10000) / 100,
    tieRatePercent: Math.round((ties / differences.length) * 10000) / 100,
    inferenceAllowed: false,
  };
}

function batchMetric(benchmark, group, blockId) {
  const samples = requireSamples(benchmark, group);
  if (!Array.isArray(benchmark?.batchEvidence) || benchmark.batchEvidence.length !== C2_1_BATCHES_PER_BLOCK) {
    throw new Error(`restart block ${blockId} ${group} requires ${C2_1_BATCHES_PER_BLOCK} retained batches.`);
  }
  return benchmark.batchEvidence.map((batch) => {
    if (!Array.isArray(batch?.sampleIndexes) || batch.sampleIndexes.length === 0) {
      throw new Error(`restart block ${blockId} batch ${batch?.batchId ?? 'missing'} has no retained sample indexes.`);
    }
    const solr = batch.sampleIndexes.map((index) => samples.solr[index]);
    const openSearch = batch.sampleIndexes.map((index) => samples.openSearch[index]);
    if (solr.some((value) => !Number.isFinite(value)) || openSearch.some((value) => !Number.isFinite(value))) {
      throw new Error(`restart block ${blockId} batch ${batch.batchId} references an invalid sample index.`);
    }
    const solrMedianMs = nearestRankPercentile(solr, 0.5);
    const openSearchMedianMs = nearestRankPercentile(openSearch, 0.5);
    return {
      blockId,
      batchId: batch.batchId,
      executionOrder: batch.executionOrder,
      measuredRuns: batch.measuredRuns,
      solrMedianMs,
      openSearchMedianMs,
      differenceMs: openSearchMedianMs - solrMedianMs,
    };
  });
}

function effectDirection(medianDifferenceMs) {
  if (medianDifferenceMs > 0) {
    return 'SOLR_LOWER_LATENCY';
  }
  if (medianDifferenceMs < 0) {
    return 'OPENSEARCH_LOWER_LATENCY';
  }
  return 'TIE';
}

function summarizeBatchEffects(units, seed) {
  if (units.length !== EXPECTED_BATCH_UNITS) {
    throw new Error(`C2.1 batch inference requires exactly ${EXPECTED_BATCH_UNITS} independent batch summaries; found ${units.length}.`);
  }
  const statistics = summarizePairedLatencyEvidence(
    units.map((unit) => unit.solrMedianMs),
    units.map((unit) => unit.openSearchMedianMs),
    { seed },
  );
  const openSearchWins = units.filter((unit) => unit.differenceMs < 0).length;
  return {
    experimentalUnit:
      'One independently warmed batch nested within a clean restart block; each batch contributes one Solr median and one OpenSearch median.',
    batchCount: units.length,
    effectSign: 'OpenSearch - Solr; positive means OpenSearch was slower.',
    direction: effectDirection(statistics.medianDifferenceMs),
    openSearchWinRatePercent: Math.round((openSearchWins / units.length) * 10000) / 100,
    statistics,
    units,
  };
}

function semanticCellMap(semantic) {
  return new Map(
    (Array.isArray(semantic?.cells) ? semantic.cells : []).map((cell) => [cell.id, cell]),
  );
}

function workloadForBlock(block, id) {
  const workload = block?.workloads?.find((candidate) => candidate.id === id);
  if (!workload) {
    throw new Error(`Restart block ${block?.blockId ?? 'missing'} is missing workload ${id}.`);
  }
  if (workload?.benchmark?.projection?.projectionId !== C2_1_EXPECTED.projectionId) {
    throw new Error(`${id}: benchmark projection drifted.`);
  }
  if (workload?.benchmark?.openSearchTreatment !== C2_1_ADMITTED_TREATMENT) {
    throw new Error(`${id}: benchmark treatment drifted.`);
  }
  return workload;
}

function summarizeCell({ suite, semanticById, matrixCell, index }) {
  const apiSolr = [];
  const apiOpenSearch = [];
  const nativeSolr = [];
  const nativeOpenSearch = [];
  const apiUnits = [];
  const nativeUnits = [];

  for (const block of suite.restartBlocks) {
    const workload = workloadForBlock(block, matrixCell.id);
    const api = requireSamples(workload.benchmark, 'apiElapsed');
    const native = requireSamples(workload.benchmark, 'engineReported');
    apiSolr.push(...api.solr);
    apiOpenSearch.push(...api.openSearch);
    nativeSolr.push(...native.solr);
    nativeOpenSearch.push(...native.openSearch);
    apiUnits.push(...batchMetric(workload.benchmark, 'apiElapsed', block.blockId));
    nativeUnits.push(...batchMetric(workload.benchmark, 'engineReported', block.blockId));
  }

  const semantic = semanticById.get(matrixCell.id);
  if (!semantic?.semantic?.admitted) {
    throw new Error(`${matrixCell.id}: semantic-admission cell is missing or not admitted.`);
  }

  return {
    id: matrixCell.id,
    family: matrixCell.family,
    class: matrixCell.class ?? null,
    band: matrixCell.band ?? null,
    selected: matrixCell.selected ?? null,
    request: matrixCell.request,
    totalHits: Number(semantic.semantic.totalHits),
    semantic: {
      admitted: true,
      totalHitsEqual: semantic.semantic.crossEngine?.totalHitsEqual === true,
      facetCountsEqual: semantic.semantic.crossEngine?.facetCountsEqual === true,
      topNExactOrder: semantic.semantic.crossEngine?.topNExactOrder === true,
    },
    requestLevelDescriptive: {
      apiElapsed: descriptivePair(apiSolr, apiOpenSearch),
      engineReported: descriptivePair(nativeSolr, nativeOpenSearch),
    },
    batchLevelInference: {
      apiElapsed: summarizeBatchEffects(apiUnits, C2_1_ROOT_SEED + index),
      engineReported: summarizeBatchEffects(
        nativeUnits,
        C2_1_ROOT_SEED + 1000 + index,
      ),
    },
  };
}

function summarizeDirections(cells, metric) {
  const directions = cells.map((cell) => cell.batchLevelInference[metric]);
  return {
    solrLowerLatencyCells: directions.filter((row) => row.direction === 'SOLR_LOWER_LATENCY').length,
    openSearchLowerLatencyCells: directions.filter((row) => row.direction === 'OPENSEARCH_LOWER_LATENCY').length,
    tiedCells: directions.filter((row) => row.direction === 'TIE').length,
    ciExcludesZeroFavoringSolr: directions.filter(
      (row) =>
        row.direction === 'SOLR_LOWER_LATENCY' &&
        row.statistics.bootstrap.excludesZero,
    ).length,
    ciExcludesZeroFavoringOpenSearch: directions.filter(
      (row) =>
        row.direction === 'OPENSEARCH_LOWER_LATENCY' &&
        row.statistics.bootstrap.excludesZero,
    ).length,
  };
}

export function synthesizeC21Report({ suite, semantic, now = () => new Date() } = {}) {
  const accepted = requireAcceptedSuite(suite);
  const admitted = requireSemanticAdmission(semantic);
  const semanticById = semanticCellMap(admitted);
  const cells = accepted.workloadMatrix.map((matrixCell, index) =>
    summarizeCell({ suite: accepted, semanticById, matrixCell, index }),
  );
  const measuredIds = new Set(cells.map((cell) => cell.id));
  const filterBands = C2_1_SELECTIVITY_BANDS.map((band) => {
    const semanticBand = admitted.filterSelection?.bands?.find(
      (candidate) => candidate.band === band.id,
    );
    return {
      ...band,
      status: semanticBand?.status ?? 'NOT_RECORDED',
      selected: semanticBand?.selected ?? null,
      measured: measuredIds.has(`FILTER_${band.id}`),
    };
  });

  return {
    experiment: 'C2.1_ADVERSARIAL_STANDALONE',
    kind: 'c2-1-statistical-report',
    capturedAt: now().toISOString(),
    scope: C2_1_EXPECTED.scope,
    comparativeClaimAllowed: false,
    projectionId: C2_1_EXPECTED.projectionId,
    projectionObjectCount: C2_1_EXPECTED.projectionObjectCount,
    openSearchTreatment: C2_1_ADMITTED_TREATMENT,
    historicalC2Baseline: {
      relationship: 'SEPARATE_REFERENCE_ONLY',
      artifact: 'browser-evidence-artifacts/search-comparison-statistical-report.json',
      statement:
        'Certified C2 remains historical baseline evidence. C2.1 is an adversarial optimized-treatment experiment and does not overwrite or pool its samples with C2.',
    },
    inferenceContract: {
      preferredExperimentalUnit:
        'Independently warmed batch median nested within a clean restart block.',
      restartBlocks: C2_1_RESTART_BLOCKS,
      batchesPerRestartBlock: C2_1_BATCHES_PER_BLOCK,
      independentBatchSummariesPerCell: EXPECTED_BATCH_UNITS,
      effectSign: 'OpenSearch - Solr; positive means OpenSearch was slower.',
      bootstrap:
        'Paired percentile bootstrap of the 16 batch-level median effects; request samples are not bootstrap experimental units.',
      multiplicity:
        'Per-cell 95% intervals are not multiplicity-adjusted. No family-wide significance claim is made across the workload matrix.',
    },
    summary: {
      workloadCellCount: cells.length,
      apiElapsed: summarizeDirections(cells, 'apiElapsed'),
      engineReported: summarizeDirections(cells, 'engineReported'),
      openSearchLeadingApiCellIds: cells
        .filter(
          (cell) =>
            cell.batchLevelInference.apiElapsed.direction ===
            'OPENSEARCH_LOWER_LATENCY',
        )
        .map((cell) => cell.id),
      openSearchLeadingNativeCellIds: cells
        .filter(
          (cell) =>
            cell.batchLevelInference.engineReported.direction ===
            'OPENSEARCH_LOWER_LATENCY',
        )
        .map((cell) => cell.id),
    },
    filterBands,
    unavailableBands: admitted.unavailableBands ?? [],
    cells,
    claimGuardrail:
      'This report supports only scoped statements about the certified 1,000,181-object projection, named engine versions/resources, preregistered workload cells, optimized OpenSearch treatment and local standalone Docker topology. It is not evidence that either engine is universally faster.',
  };
}

function format(value) {
  return value === null || value === undefined ? 'n/a' : String(value);
}

function ci(statistics) {
  return `${statistics.bootstrap.lowerMs} .. ${statistics.bootstrap.upperMs}`;
}

function requestLabel(cell) {
  if (cell.request?.query) {
    return cell.request.query.replaceAll('|', '\\|');
  }
  if (cell.selected) {
    return `${cell.selected.field}=${cell.selected.value}`.replaceAll('|', '\\|');
  }
  return cell.family;
}

function percentileTable(cells, metric) {
  return cells
    .map((cell) => {
      const descriptive = cell.requestLevelDescriptive[metric];
      const batch = cell.batchLevelInference[metric];
      return `| ${cell.id} | ${requestLabel(cell)} | ${format(cell.totalHits)} | ${descriptive.solr.p50Ms} | ${descriptive.solr.p90Ms} | ${descriptive.solr.p95Ms} | ${descriptive.solr.p99Ms} | ${descriptive.openSearch.p50Ms} | ${descriptive.openSearch.p90Ms} | ${descriptive.openSearch.p95Ms} | ${descriptive.openSearch.p99Ms} | ${batch.statistics.medianDifferenceMs} | ${ci(batch.statistics)} | ${batch.direction} |`;
    })
    .join('\n');
}

export function renderC21Markdown(report) {
  const api = report.summary.apiElapsed;
  const native = report.summary.engineReported;
  const filterRows = report.filterBands
    .map(
      (band) =>
        `| ${band.id} | ${band.status} | ${format(band.selected?.normalizedIdentity)} | ${format(band.selected?.count)} | ${format(band.selected?.selectivityPercent)} | ${band.measured ? 'yes' : 'no'} |`,
    )
    .join('\n');
  const header =
    '| Cell | Query/filter | Hits | Solr p50 | Solr p90 | Solr p95 | Solr p99 | OpenSearch p50 | OpenSearch p90 | OpenSearch p95 | OpenSearch p99 | Batch median diff | 95% CI | Direction |';
  const separator =
    '| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- |';

  return `# C2.1 Adversarial Solr/OpenSearch Statistical Report\n\nCaptured: ${report.capturedAt}\n\n- Projection: \`${report.projectionId}\` (${report.projectionObjectCount.toLocaleString('en-US')} objects)\n- Treatment: \`${report.openSearchTreatment}\`\n- Restart blocks: **${report.inferenceContract.restartBlocks}**\n- Independent batch summaries per cell: **${report.inferenceContract.independentBatchSummariesPerCell}**\n- Effect sign: **OpenSearch - Solr**; positive means OpenSearch was slower.\n- Request timings below are descriptive. The 95% intervals use **batch medians**, not request samples.\n- Multiplicity: ${report.inferenceContract.multiplicity}\n\n## Direction summary\n\nAPI elapsed: Solr lower-latency median effect in **${api.solrLowerLatencyCells}** cells; OpenSearch lower-latency median effect in **${api.openSearchLowerLatencyCells}**; ties **${api.tiedCells}**. Batch-level 95% CI excludes zero favoring Solr in **${api.ciExcludesZeroFavoringSolr}** cells and favoring OpenSearch in **${api.ciExcludesZeroFavoringOpenSearch}**.\n\nNative timing: Solr lower-latency median effect in **${native.solrLowerLatencyCells}** cells; OpenSearch lower-latency median effect in **${native.openSearchLowerLatencyCells}**; ties **${native.tiedCells}**. Batch-level 95% CI excludes zero favoring Solr in **${native.ciExcludesZeroFavoringSolr}** cells and favoring OpenSearch in **${native.ciExcludesZeroFavoringOpenSearch}**.\n\nOpenSearch-leading API cells: ${report.summary.openSearchLeadingApiCellIds.length ? report.summary.openSearchLeadingApiCellIds.map((id) => `\`${id}\``).join(', ') : 'none'}.\n\nOpenSearch-leading native cells: ${report.summary.openSearchLeadingNativeCellIds.length ? report.summary.openSearchLeadingNativeCellIds.map((id) => `\`${id}\``).join(', ') : 'none'}.\n\n## Filter-band realization\n\n| Band | Status | Selected identity | Count | Selectivity % | Measured |\n| --- | --- | --- | ---: | ---: | --- |\n${filterRows}\n\n## API elapsed — request percentiles and batch-level inference\n\n${header}\n${separator}\n${percentileTable(report.cells, 'apiElapsed')}\n\n## Native engine timing — descriptive percentiles and batch-level inference\n\n${header}\n${separator}\n${percentileTable(report.cells, 'engineReported')}\n\n## Evidence boundary\n\n${report.historicalC2Baseline.statement}\n\n${report.claimGuardrail}\n`;
}

export async function writeC21Report({
  measurement = DEFAULT_MEASUREMENT,
  semantic = DEFAULT_SEMANTIC,
  jsonOutput = DEFAULT_JSON_OUTPUT,
  markdownOutput = DEFAULT_MARKDOWN_OUTPUT,
} = {}) {
  const [suite, semanticEvidence] = await Promise.all([
    readFile(measurement, 'utf8').then(JSON.parse),
    readFile(semantic, 'utf8').then(JSON.parse),
  ]);
  const report = synthesizeC21Report({ suite, semantic: semanticEvidence });
  const jsonPath = resolve(jsonOutput);
  const markdownPath = resolve(markdownOutput);
  await Promise.all([
    mkdir(dirname(jsonPath), { recursive: true }),
    mkdir(dirname(markdownPath), { recursive: true }),
  ]);
  await Promise.all([
    writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8'),
    writeFile(markdownPath, renderC21Markdown(report), 'utf8'),
  ]);
  return { report, jsonPath, markdownPath };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  writeC21Report()
    .then(({ report, jsonPath, markdownPath }) => {
      console.log(`C2.1 statistical report JSON written to ${jsonPath}`);
      console.log(`C2.1 statistical report Markdown written to ${markdownPath}`);
      console.log(
        `Cells ${report.summary.workloadCellCount}; API median direction Solr ${report.summary.apiElapsed.solrLowerLatencyCells}, OpenSearch ${report.summary.apiElapsed.openSearchLowerLatencyCells}, ties ${report.summary.apiElapsed.tiedCells}.`,
      );
      console.log(report.claimGuardrail);
    })
    .catch((error) => {
      console.error(`C2.1 report REFUSED: ${error.message}`);
      process.exitCode = 1;
    });
}
