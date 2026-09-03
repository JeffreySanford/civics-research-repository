import assert from 'node:assert/strict';
import test from 'node:test';
import {
  captureResourceSnapshot,
  normalizeDockerStats,
  normalizeOpenSearchTelemetry,
  normalizeSolrTelemetry,
  parseByteQuantity,
  runTelemetryWrappedConcurrencyMatrix,
  summarizeResourceDelta,
} from './search-comparison-resource-telemetry.mjs';

test('byte and Docker stats normalization preserves raw evidence', () => {
  assert.equal(parseByteQuantity('512MiB'), 512 * 1024 ** 2);
  assert.equal(parseByteQuantity('1.5GB'), 1.5 * 1000 ** 3);
  assert.equal(parseByteQuantity('unknown'), null);

  const result = normalizeDockerStats({
    Name: 'project-solr-1',
    CPUPerc: '12.5%',
    MemUsage: '512MiB / 2GiB',
    MemPerc: '25.0%',
    NetIO: '1MB / 2MB',
    BlockIO: '3MB / 4MB',
    PIDs: '42',
  });
  assert.equal(result.cpuPercent, 12.5);
  assert.equal(result.memoryUsedBytes, 512 * 1024 ** 2);
  assert.equal(result.memoryLimitBytes, 2 * 1024 ** 3);
  assert.equal(result.pids, 42);
  assert.equal(result.raw.networkIo, '1MB / 2MB');
});

test('Solr telemetry preserves registries and separates cumulative counters from CPU/load gauges', () => {
  const result = normalizeSolrTelemetry({
    metrics: {
      'solr.jvm': {
        'memory.heap.used': 100,
        'memory.heap.max': 500,
        'gc.G1-Young-Generation.count': 4,
        'gc.G1-Young-Generation.time': 22,
        'os.processCpuLoad': 0.5,
        'os.processCpuTime': 1000,
        'threads.count': 30,
      },
      'solr.node': {
        'CONTAINER.cores.loaded': 1,
      },
    },
  });

  assert.equal(result.rawRegistries.jvm['memory.heap.used'], 100);
  assert.equal(
    result.normalizedMetricGroups.garbageCollection[
      'jvm.gc.G1-Young-Generation.count'
    ],
    4,
  );
  assert.equal(
    result.normalizedMetricGroups.garbageCollectionCounters[
      'jvm.gc.G1-Young-Generation.count'
    ],
    4,
  );
  assert.equal(
    result.normalizedMetricGroups.cpuAndLoad['jvm.os.processCpuLoad'],
    0.5,
  );
  assert.equal(
    result.normalizedMetricGroups.cpuTimeCounters['jvm.os.processCpuTime'],
    1000,
  );
  assert.equal(
    result.normalizedMetricGroups.cpuTimeCounters['jvm.os.processCpuLoad'],
    undefined,
  );
  assert.equal(result.normalizedMetricGroups.threads['jvm.threads.count'], 30);
});

test('OpenSearch telemetry normalizes JVM, GC, CPU and search counters', () => {
  const result = normalizeOpenSearchTelemetry({
    nodes: {
      node1: {
        name: 'opensearch',
        process: {
          cpu: { percent: 18, total_in_millis: 1000 },
          open_file_descriptors: 100,
        },
        os: {
          cpu: { percent: 22 },
          mem: { used_in_bytes: 2000, used_percent: 50 },
        },
        jvm: {
          uptime_in_millis: 5000,
          mem: {
            heap_used_in_bytes: 300,
            heap_used_percent: 30,
            heap_committed_in_bytes: 600,
            heap_max_in_bytes: 1000,
          },
          threads: { count: 12 },
          gc: {
            collectors: {
              young: {
                collection_count: 4,
                collection_time_in_millis: 20,
              },
              old: {
                collection_count: 1,
                collection_time_in_millis: 10,
              },
            },
          },
        },
        indices: {
          search: {
            query_total: 20,
            query_time_in_millis: 200,
            open_contexts: 0,
          },
        },
      },
    },
  });

  assert.equal(result.nodeId, 'node1');
  assert.equal(result.jvm.gcCollectionCount, 5);
  assert.equal(result.jvm.gcCollectionTimeMillis, 30);
  assert.equal(result.jvm.heapUsedBytes, 300);
  assert.equal(result.process.cpuTotalMillis, 1000);
  assert.equal(result.search.queryTotal, 20);
});

function response(payload) {
  return {
    ok: true,
    status: 200,
    async json() {
      return payload;
    },
  };
}

test('resource snapshot joins vendor metrics with Compose service Docker stats', async () => {
  const fetchImpl = async (url) => {
    if (url.includes('8983')) {
      return response({
        metrics: {
          'solr.jvm': {
            'memory.heap.used': 100,
            'gc.young.count': 2,
          },
          'solr.node': {},
        },
      });
    }
    return response({
      nodes: {
        n1: {
          name: 'opensearch',
          process: { cpu: { percent: 1, total_in_millis: 2 } },
          os: { cpu: { percent: 3 }, mem: { used_in_bytes: 4 } },
          jvm: { mem: {}, threads: {}, gc: { collectors: {} } },
          indices: { search: {} },
        },
      },
    });
  };

  const dockerCalls = [];
  const execFileImpl = async (file, args) => {
    dockerCalls.push([file, args]);
    if (args[0] === 'compose') {
      return {
        stdout: JSON.stringify([
          { Service: 'solr', ID: 'solr-id' },
          { Service: 'opensearch', ID: 'os-id' },
          { Service: 'repository-api', ID: 'api-id' },
          { Service: 'postgres', ID: 'db-id' },
        ]),
      };
    }
    const id = args.at(-1);
    return {
      stdout: JSON.stringify({
        Name: id,
        CPUPerc: '1%',
        MemUsage: '100MiB / 1GiB',
        MemPerc: '10%',
        PIDs: '10',
      }),
    };
  };

  const result = await captureResourceSnapshot({
    fetchImpl,
    execFileImpl,
    now: () => new Date('2026-09-03T17:10:00Z'),
  });
  assert.equal(result.capturedAt, '2026-09-03T17:10:00.000Z');
  assert.deepEqual(Object.keys(result.docker).sort(), [
    'opensearch',
    'repository-api',
    'solr',
  ]);
  assert.equal(dockerCalls.length, 4);
  assert.equal(result.docker.solr.memoryUsedBytes, 100 * 1024 ** 2);
});

test('resource delta separates cumulative counters from instantaneous observations', () => {
  const before = {
    openSearch: {
      process: { cpuTotalMillis: 100, cpuPercent: 10 },
      jvm: {
        gcCollectionCount: 5,
        gcCollectionTimeMillis: 40,
        heapUsedBytes: 200,
      },
      search: { queryTotal: 10, queryTimeMillis: 80 },
    },
    solr: {
      normalizedMetricGroups: {
        garbageCollection: { 'jvm.gc.count': 2, 'jvm.gc.rate': 0.1 },
        garbageCollectionCounters: { 'jvm.gc.count': 2 },
        cpuAndLoad: {
          'jvm.os.processCpuTime': 100,
          'jvm.os.processCpuLoad': 0.4,
        },
        cpuTimeCounters: { 'jvm.os.processCpuTime': 100 },
        heapAndMemory: { 'jvm.memory.heap.used': 300 },
      },
    },
    docker: {
      solr: {
        memoryUsedBytes: 1000,
        pids: 20,
        cpuPercent: 10,
        memoryPercent: 20,
      },
    },
  };
  const after = {
    openSearch: {
      process: { cpuTotalMillis: 160, cpuPercent: 12 },
      jvm: {
        gcCollectionCount: 8,
        gcCollectionTimeMillis: 55,
        heapUsedBytes: 250,
      },
      search: { queryTotal: 18, queryTimeMillis: 140 },
    },
    solr: {
      normalizedMetricGroups: {
        garbageCollection: { 'jvm.gc.count': 4, 'jvm.gc.rate': 0.2 },
        garbageCollectionCounters: { 'jvm.gc.count': 4 },
        cpuAndLoad: {
          'jvm.os.processCpuTime': 150,
          'jvm.os.processCpuLoad': 0.6,
        },
        cpuTimeCounters: { 'jvm.os.processCpuTime': 150 },
        heapAndMemory: { 'jvm.memory.heap.used': 350 },
      },
    },
    docker: {
      solr: {
        memoryUsedBytes: 1200,
        pids: 21,
        cpuPercent: 11,
        memoryPercent: 22,
      },
    },
  };

  const result = summarizeResourceDelta(before, after);
  assert.equal(result.openSearch.processCpuTotalMillisDelta, 60);
  assert.equal(result.openSearch.gcCollectionCountDelta, 3);
  assert.equal(result.openSearch.searchQueryTotalDelta, 8);
  assert.equal(result.solr.garbageCollectionMetricDeltas['jvm.gc.count'], 2);
  assert.equal(
    result.solr.garbageCollectionMetricDeltas['jvm.gc.rate'],
    undefined,
  );
  assert.equal(result.solr.cpuTimeMetricDeltas['jvm.os.processCpuTime'], 50);
  assert.equal(
    result.solr.beforeCpuAndLoadMetrics['jvm.os.processCpuLoad'],
    0.4,
  );
  assert.equal(
    result.solr.afterCpuAndLoadMetrics['jvm.os.processCpuLoad'],
    0.6,
  );
  assert.equal(result.solr.cpuAndLoadMetricDeltas, undefined);
  assert.equal(result.counterResetDetected, false);
  assert.deepEqual(result.counterResetFields, []);
  assert.equal(result.docker.solr.memoryUsedBytesDelta, 200);
  assert.equal(result.docker.solr.beforeCpuPercent, 10);
  assert.equal(result.docker.solr.afterCpuPercent, 11);
});

test('resource delta omits regressed counters and surfaces reset evidence', () => {
  const before = {
    openSearch: {
      process: { cpuTotalMillis: 1000, cpuPercent: 10 },
      jvm: {
        gcCollectionCount: 20,
        gcCollectionTimeMillis: 200,
        heapUsedBytes: 300,
      },
      search: { queryTotal: 500, queryTimeMillis: 4000 },
    },
    solr: {
      normalizedMetricGroups: {
        garbageCollection: { 'jvm.gc.count': 10 },
        garbageCollectionCounters: { 'jvm.gc.count': 10 },
        cpuAndLoad: { 'jvm.os.processCpuTime': 900 },
        cpuTimeCounters: { 'jvm.os.processCpuTime': 900 },
        heapAndMemory: {},
      },
    },
    docker: {},
  };
  const after = {
    openSearch: {
      process: { cpuTotalMillis: 50, cpuPercent: 5 },
      jvm: {
        gcCollectionCount: 1,
        gcCollectionTimeMillis: 5,
        heapUsedBytes: 100,
      },
      search: { queryTotal: 2, queryTimeMillis: 10 },
    },
    solr: {
      normalizedMetricGroups: {
        garbageCollection: { 'jvm.gc.count': 1 },
        garbageCollectionCounters: { 'jvm.gc.count': 1 },
        cpuAndLoad: { 'jvm.os.processCpuTime': 40 },
        cpuTimeCounters: { 'jvm.os.processCpuTime': 40 },
        heapAndMemory: {},
      },
    },
    docker: {},
  };

  const result = summarizeResourceDelta(before, after);
  assert.equal(result.counterResetDetected, true);
  assert.equal(result.openSearch.processCpuTotalMillisDelta, null);
  assert.equal(result.openSearch.gcCollectionCountDelta, null);
  assert.equal(result.openSearch.searchQueryTotalDelta, null);
  assert.equal(result.solr.garbageCollectionMetricDeltas['jvm.gc.count'], undefined);
  assert.equal(result.solr.cpuTimeMetricDeltas['jvm.os.processCpuTime'], undefined);
  assert.ok(
    result.counterResetFields.includes('openSearch.process.cpuTotalMillis'),
  );
  assert.ok(
    result.counterResetFields.includes(
      'solr.cpuTimeCounters.jvm.os.processCpuTime',
    ),
  );
});

test('telemetry wrapper brackets the benchmark and keeps claims conservative', async () => {
  let captures = 0;
  const captureSnapshot = async () => {
    captures += 1;
    return {
      openSearch: {
        process: { cpuTotalMillis: captures * 10, cpuPercent: captures },
        jvm: {
          gcCollectionCount: captures,
          gcCollectionTimeMillis: captures * 2,
          heapUsedBytes: captures * 100,
        },
        search: {
          queryTotal: captures * 5,
          queryTimeMillis: captures * 7,
        },
      },
      solr: {
        normalizedMetricGroups: {
          garbageCollection: { 'jvm.gc.count': captures },
          garbageCollectionCounters: { 'jvm.gc.count': captures },
          cpuAndLoad: {
            'jvm.os.processCpuTime': captures * 10,
            'jvm.os.processCpuLoad': captures / 10,
          },
          cpuTimeCounters: { 'jvm.os.processCpuTime': captures * 10 },
          heapAndMemory: { 'jvm.memory.heap.used': captures * 100 },
        },
      },
      docker: {},
    };
  };
  const runBenchmark = async () => ({
    projection: { projectionId: 'a'.repeat(64), objectCount: 100181 },
  });

  const result = await runTelemetryWrappedConcurrencyMatrix({
    captureSnapshot,
    runBenchmark,
    now: () => new Date('2026-09-03T17:15:00Z'),
  });
  assert.equal(captures, 2);
  assert.equal(result.comparativeClaimAllowed, false);
  assert.equal(
    result.resourceTelemetry.delta.openSearch.processCpuTotalMillisDelta,
    10,
  );
  assert.equal(
    result.resourceTelemetry.delta.solr.cpuTimeMetricDeltas[
      'jvm.os.processCpuTime'
    ],
    10,
  );
  assert.equal(result.resourceTelemetry.delta.counterResetDetected, false);
  assert.match(result.methodology, /Counter regressions/);
});
