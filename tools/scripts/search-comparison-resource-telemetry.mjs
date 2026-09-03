import { execFile } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import { runConcurrencyMatrix } from './search-comparison-concurrency.mjs';

const execFileAsync = promisify(execFile);
const DEFAULT_SOLR_BASE_URL = 'http://localhost:8983/solr';
const DEFAULT_OPENSEARCH_BASE_URL = 'http://localhost:9200';
const DEFAULT_OUTPUT =
  'browser-evidence-artifacts/search-comparison-resource-telemetry.json';
const RESOURCE_SERVICES = Object.freeze([
  'repository-api',
  'solr',
  'opensearch',
]);

function requireFiniteNumber(value, label) {
  if (!Number.isFinite(value)) {
    throw new Error(`${label} must be a finite number.`);
  }
  return value;
}

function parsePercent(value) {
  if (typeof value !== 'string') {
    return null;
  }
  const parsed = Number(value.replace('%', '').trim());
  return Number.isFinite(parsed) ? parsed : null;
}

const BYTE_UNITS = Object.freeze({
  B: 1,
  KB: 1000,
  MB: 1000 ** 2,
  GB: 1000 ** 3,
  TB: 1000 ** 4,
  KIB: 1024,
  MIB: 1024 ** 2,
  GIB: 1024 ** 3,
  TIB: 1024 ** 4,
});

export function parseByteQuantity(value) {
  if (typeof value !== 'string') {
    return null;
  }
  const match = value.trim().match(/^([0-9]+(?:\.[0-9]+)?)\s*([kmgt]?i?b)$/i);
  if (!match) {
    return null;
  }
  const amount = Number(match[1]);
  const multiplier = BYTE_UNITS[match[2].toUpperCase()];
  return Number.isFinite(amount) && multiplier ? amount * multiplier : null;
}

function parseMemoryUsage(value) {
  if (typeof value !== 'string') {
    return { usedBytes: null, limitBytes: null };
  }
  const [used, limit] = value.split('/').map((part) => part.trim());
  return {
    usedBytes: parseByteQuantity(used),
    limitBytes: parseByteQuantity(limit),
  };
}

function parseJsonDocuments(text) {
  const trimmed = String(text ?? '').trim();
  if (!trimmed) {
    return [];
  }
  try {
    const parsed = JSON.parse(trimmed);
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    return trimmed
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => JSON.parse(line));
  }
}

function serviceName(entry) {
  return entry.Service ?? entry.service ?? entry.Name ?? entry.name ?? null;
}

function containerId(entry) {
  return entry.ID ?? entry.Id ?? entry.id ?? null;
}

export function normalizeDockerStats(raw) {
  const memory = parseMemoryUsage(raw.MemUsage ?? raw.mem_usage ?? '');
  return {
    container: raw.Name ?? raw.name ?? null,
    cpuPercent: parsePercent(raw.CPUPerc ?? raw.cpu_perc),
    memoryPercent: parsePercent(raw.MemPerc ?? raw.mem_perc),
    memoryUsedBytes: memory.usedBytes,
    memoryLimitBytes: memory.limitBytes,
    pids: Number.isFinite(Number(raw.PIDs ?? raw.pids))
      ? Number(raw.PIDs ?? raw.pids)
      : null,
    raw: {
      cpu: raw.CPUPerc ?? raw.cpu_perc ?? null,
      memory: raw.MemUsage ?? raw.mem_usage ?? null,
      memoryPercent: raw.MemPerc ?? raw.mem_perc ?? null,
      networkIo: raw.NetIO ?? raw.net_io ?? null,
      blockIo: raw.BlockIO ?? raw.block_io ?? null,
      pids: raw.PIDs ?? raw.pids ?? null,
    },
  };
}

async function captureDockerStats(execFileImpl) {
  const ps = await execFileImpl('docker', [
    'compose',
    'ps',
    '--format',
    'json',
  ]);
  const containers = parseJsonDocuments(ps.stdout);
  const selected = containers.filter((entry) =>
    RESOURCE_SERVICES.includes(serviceName(entry)),
  );
  const result = {};

  for (const entry of selected) {
    const service = serviceName(entry);
    const id = containerId(entry);
    if (!service || !id) {
      continue;
    }
    const stats = await execFileImpl('docker', [
      'stats',
      '--no-stream',
      '--format',
      '{{json .}}',
      id,
    ]);
    const [raw] = parseJsonDocuments(stats.stdout);
    if (raw) {
      result[service] = normalizeDockerStats(raw);
    }
  }
  return result;
}

function flattenNumericMetrics(value, prefix = '', target = {}) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    target[prefix] = value;
    return target;
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return target;
  }
  for (const [key, child] of Object.entries(value)) {
    const path = prefix ? `${prefix}.${key}` : key;
    flattenNumericMetrics(child, path, target);
  }
  return target;
}

function matchingMetrics(metrics, pattern) {
  return Object.fromEntries(
    Object.entries(metrics).filter(([key]) => pattern.test(key)),
  );
}

export function normalizeSolrTelemetry(payload) {
  const registries = payload?.metrics ?? {};
  const jvm = registries['solr.jvm'] ?? {};
  const node = registries['solr.node'] ?? {};
  const numeric = flattenNumericMetrics({ jvm, node });
  return {
    metricSelection:
      'Solr 9 JVM and node registries are preserved verbatim. Numeric metrics are additionally grouped by key pattern so version-specific JVM/GC names remain evidence instead of being silently remapped.',
    normalizedMetricGroups: {
      heapAndMemory: matchingMetrics(numeric, /heap|memory|mem\./i),
      garbageCollection: matchingMetrics(numeric, /(^|\.)gc\.|garbage/i),
      cpuAndLoad: matchingMetrics(numeric, /cpu|load/i),
      threads: matchingMetrics(numeric, /thread/i),
    },
    rawRegistries: {
      jvm,
      node,
    },
  };
}

function onlyNode(payload) {
  const nodes = Object.entries(payload?.nodes ?? {});
  if (nodes.length !== 1) {
    throw new Error(
      `Expected one OpenSearch node in the local topology, found ${nodes.length}.`,
    );
  }
  return { nodeId: nodes[0][0], node: nodes[0][1] };
}

function sumCollectorField(collectors, field) {
  return Object.values(collectors ?? {}).reduce((total, collector) => {
    const value = collector?.[field];
    return total + (Number.isFinite(value) ? value : 0);
  }, 0);
}

export function normalizeOpenSearchTelemetry(payload) {
  const { nodeId, node } = onlyNode(payload);
  return {
    nodeId,
    nodeName: node.name ?? null,
    process: {
      cpuPercent: node.process?.cpu?.percent ?? null,
      cpuTotalMillis: node.process?.cpu?.total_in_millis ?? null,
      openFileDescriptors: node.process?.open_file_descriptors ?? null,
    },
    os: {
      cpuPercent: node.os?.cpu?.percent ?? null,
      usedMemoryBytes: node.os?.mem?.used_in_bytes ?? null,
      usedMemoryPercent: node.os?.mem?.used_percent ?? null,
    },
    jvm: {
      uptimeMillis: node.jvm?.uptime_in_millis ?? null,
      heapUsedBytes: node.jvm?.mem?.heap_used_in_bytes ?? null,
      heapUsedPercent: node.jvm?.mem?.heap_used_percent ?? null,
      heapCommittedBytes: node.jvm?.mem?.heap_committed_in_bytes ?? null,
      heapMaxBytes: node.jvm?.mem?.heap_max_in_bytes ?? null,
      threadCount: node.jvm?.threads?.count ?? null,
      gcCollectionCount: sumCollectorField(
        node.jvm?.gc?.collectors,
        'collection_count',
      ),
      gcCollectionTimeMillis: sumCollectorField(
        node.jvm?.gc?.collectors,
        'collection_time_in_millis',
      ),
      collectors: node.jvm?.gc?.collectors ?? {},
    },
    search: {
      queryTotal: node.indices?.search?.query_total ?? null,
      queryTimeMillis: node.indices?.search?.query_time_in_millis ?? null,
      openContexts: node.indices?.search?.open_contexts ?? null,
    },
    rawNode: node,
  };
}

async function fetchJson(fetchImpl, url, label) {
  const response = await fetchImpl(url);
  if (!response.ok) {
    throw new Error(`${label} request failed with HTTP ${response.status}.`);
  }
  return response.json();
}

export async function captureResourceSnapshot({
  fetchImpl = globalThis.fetch,
  execFileImpl = execFileAsync,
  solrBaseUrl = DEFAULT_SOLR_BASE_URL,
  openSearchBaseUrl = DEFAULT_OPENSEARCH_BASE_URL,
  now = () => new Date(),
} = {}) {
  if (typeof fetchImpl !== 'function' || typeof execFileImpl !== 'function') {
    throw new Error(
      'Fetch and process execution implementations are required.',
    );
  }
  const solrUrl = `${solrBaseUrl.replace(/\/$/, '')}/admin/metrics?group=jvm,node&wt=json`;
  const openSearchUrl = `${openSearchBaseUrl.replace(/\/$/, '')}/_nodes/stats/jvm,process,os,indices`;
  const [solrPayload, openSearchPayload, docker] = await Promise.all([
    fetchJson(fetchImpl, solrUrl, 'Solr metrics'),
    fetchJson(fetchImpl, openSearchUrl, 'OpenSearch node stats'),
    captureDockerStats(execFileImpl),
  ]);
  return {
    capturedAt: now().toISOString(),
    sources: {
      solr: solrUrl,
      openSearch: openSearchUrl,
      docker: 'docker compose ps + docker stats --no-stream',
    },
    solr: normalizeSolrTelemetry(solrPayload),
    openSearch: normalizeOpenSearchTelemetry(openSearchPayload),
    docker,
  };
}

function numericDelta(before, after) {
  return Number.isFinite(before) && Number.isFinite(after)
    ? after - before
    : null;
}

function metricMapDelta(before = {}, after = {}) {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  return Object.fromEntries(
    [...keys]
      .map((key) => [key, numericDelta(before[key], after[key])])
      .filter(([, value]) => value !== null),
  );
}

export function summarizeResourceDelta(before, after) {
  const docker = {};
  for (const service of RESOURCE_SERVICES) {
    const previous = before.docker?.[service];
    const current = after.docker?.[service];
    if (!previous || !current) {
      continue;
    }
    docker[service] = {
      memoryUsedBytesDelta: numericDelta(
        previous.memoryUsedBytes,
        current.memoryUsedBytes,
      ),
      pidsDelta: numericDelta(previous.pids, current.pids),
      beforeCpuPercent: previous.cpuPercent,
      afterCpuPercent: current.cpuPercent,
      beforeMemoryPercent: previous.memoryPercent,
      afterMemoryPercent: current.memoryPercent,
    };
  }

  return {
    interpretation:
      'Counter-like JVM/search metrics are expressed as after-minus-before deltas. Instantaneous CPU and memory percentages are retained as before/after observations rather than mislabeled cumulative consumption.',
    openSearch: {
      processCpuTotalMillisDelta: numericDelta(
        before.openSearch.process.cpuTotalMillis,
        after.openSearch.process.cpuTotalMillis,
      ),
      gcCollectionCountDelta: numericDelta(
        before.openSearch.jvm.gcCollectionCount,
        after.openSearch.jvm.gcCollectionCount,
      ),
      gcCollectionTimeMillisDelta: numericDelta(
        before.openSearch.jvm.gcCollectionTimeMillis,
        after.openSearch.jvm.gcCollectionTimeMillis,
      ),
      searchQueryTotalDelta: numericDelta(
        before.openSearch.search.queryTotal,
        after.openSearch.search.queryTotal,
      ),
      searchQueryTimeMillisDelta: numericDelta(
        before.openSearch.search.queryTimeMillis,
        after.openSearch.search.queryTimeMillis,
      ),
      beforeHeapUsedBytes: before.openSearch.jvm.heapUsedBytes,
      afterHeapUsedBytes: after.openSearch.jvm.heapUsedBytes,
      beforeProcessCpuPercent: before.openSearch.process.cpuPercent,
      afterProcessCpuPercent: after.openSearch.process.cpuPercent,
    },
    solr: {
      garbageCollectionMetricDeltas: metricMapDelta(
        before.solr.normalizedMetricGroups.garbageCollection,
        after.solr.normalizedMetricGroups.garbageCollection,
      ),
      cpuAndLoadMetricDeltas: metricMapDelta(
        before.solr.normalizedMetricGroups.cpuAndLoad,
        after.solr.normalizedMetricGroups.cpuAndLoad,
      ),
      beforeHeapAndMemoryMetrics:
        before.solr.normalizedMetricGroups.heapAndMemory,
      afterHeapAndMemoryMetrics:
        after.solr.normalizedMetricGroups.heapAndMemory,
    },
    docker,
  };
}

export async function runTelemetryWrappedConcurrencyMatrix({
  captureSnapshot = captureResourceSnapshot,
  runBenchmark = runConcurrencyMatrix,
  captureOptions = {},
  benchmarkOptions = {},
  now = () => new Date(),
} = {}) {
  const before = await captureSnapshot(captureOptions);
  const benchmark = await runBenchmark(benchmarkOptions);
  const after = await captureSnapshot(captureOptions);
  return {
    kind: 'search-comparison-resource-telemetry',
    capturedAt: now().toISOString(),
    comparativeClaimAllowed: false,
    methodology:
      'Resource telemetry brackets the concurrency matrix without changing engine configuration. Solr JVM/node registries, OpenSearch node JVM/process/OS/index stats, and Docker service snapshots are retained with normalized summaries. Counter deltas and instantaneous observations are kept distinct; telemetry supports interpretation of the local benchmark but does not establish universal engine efficiency.',
    benchmark,
    resourceTelemetry: {
      before,
      after,
      delta: summarizeResourceDelta(before, after),
    },
  };
}

export function parseArguments(argv) {
  const options = {
    output: DEFAULT_OUTPUT,
    solrBaseUrl: DEFAULT_SOLR_BASE_URL,
    openSearchBaseUrl: DEFAULT_OPENSEARCH_BASE_URL,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const value = argv[index + 1];
    switch (argument) {
      case '--':
        break;
      case '--output':
        options.output = value;
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
      default:
        throw new Error(`Unknown resource telemetry argument: ${argument}`);
    }
  }
  return options;
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const result = await runTelemetryWrappedConcurrencyMatrix({
    captureOptions: {
      solrBaseUrl: options.solrBaseUrl,
      openSearchBaseUrl: options.openSearchBaseUrl,
    },
  });
  const outputPath = resolve(options.output);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  console.log(`Resource telemetry evidence written to ${outputPath}`);
  console.log(
    `Projection: ${result.benchmark.projection.projectionId} (${result.benchmark.projection.objectCount} documents)`,
  );
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
