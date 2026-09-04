import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildC21ExecutionManifest,
  C2_1_EXPECTED,
  sha256Json,
} from './search-comparison-c2-1-manifest.mjs';

const SOLR_IMAGE_ID = `sha256:${'1'.repeat(64)}`;
const OPENSEARCH_IMAGE_ID = `sha256:${'2'.repeat(64)}`;
const PHYSICAL_INDEX = 'discovery-comparison-c2-1-20260903';

function validInput() {
  return {
    capturedAt: '2026-09-03T23:59:00.000Z',
    repositoryCommit: 'a'.repeat(40),
    protocolCommit: 'b'.repeat(40),
    protocolSha256: 'c'.repeat(64),
    worktreeStatus: '',
    dockerVersion: {
      Platform: { Name: 'Docker Engine - Community' },
      Version: '27.5.1',
    },
    evidence: {
      profile: C2_1_EXPECTED.profile,
      scope: C2_1_EXPECTED.scope,
      projectionId: C2_1_EXPECTED.projectionId,
      projectionObjectCount: C2_1_EXPECTED.projectionObjectCount,
      retainedFederatedRecords: C2_1_EXPECTED.retainedFederatedRecords,
      targetParity: true,
      comparativeClaimAllowed: false,
    },
    solrContainer: {
      Id: 'solr-container',
      Image: SOLR_IMAGE_ID,
      Config: {
        Image: C2_1_EXPECTED.solrImage,
        Env: ['SOLR_HEAP=512m'],
      },
      HostConfig: {
        NanoCpus: C2_1_EXPECTED.nanoCpus,
        Memory: C2_1_EXPECTED.memoryBytes,
      },
    },
    openSearchContainer: {
      Id: 'opensearch-container',
      Image: OPENSEARCH_IMAGE_ID,
      Config: {
        Image: C2_1_EXPECTED.openSearchImage,
        Env: ['OPENSEARCH_JAVA_OPTS=-Xms512m -Xmx512m'],
      },
      HostConfig: {
        NanoCpus: C2_1_EXPECTED.nanoCpus,
        Memory: C2_1_EXPECTED.memoryBytes,
      },
    },
    solrImage: {
      Id: SOLR_IMAGE_ID,
      RepoDigests: [`solr@sha256:${'3'.repeat(64)}`],
      Created: '2026-08-01T00:00:00Z',
    },
    openSearchImage: {
      Id: OPENSEARCH_IMAGE_ID,
      RepoDigests: [
        `opensearchproject/opensearch@sha256:${'4'.repeat(64)}`,
      ],
      Created: '2026-08-01T00:00:00Z',
    },
    solrRuntime: {
      systemInfo: {
        lucene: { 'solr-spec-version': '9.10.1' },
        jvm: { version: '21.0.8' },
      },
      coreStatus: {
        status: {
          discovery: {
            startTime: '2026-09-03T23:00:00Z',
            uptime: 1000,
            index: {
              numDocs: C2_1_EXPECTED.projectionObjectCount,
              version: 42,
              current: true,
            },
          },
        },
      },
      config: { config: { query: { filterCache: { size: 512 } } } },
      schema: { schema: { name: 'discovery' } },
    },
    openSearchRuntime: {
      root: { version: { number: C2_1_EXPECTED.openSearchVersion } },
      nodesJvm: {
        nodes: {
          'node-1': { jvm: { version: '21.0.8' } },
        },
      },
      settings: {
        [PHYSICAL_INDEX]: {
          settings: {
            'index.number_of_shards': '1',
            'index.number_of_replicas': '0',
            'index.refresh_interval': '1s',
          },
        },
      },
      mapping: {
        [PHYSICAL_INDEX]: {
          mappings: { properties: { id: { type: 'keyword' } } },
        },
      },
      count: { count: C2_1_EXPECTED.projectionObjectCount },
    },
    readState: {
      preparedAt: '2026-09-03T23:58:59.000Z',
      solrCommit: { responseHeader: { status: 0 } },
      openSearchRefresh: { _shards: { total: 1, successful: 1, failed: 0 } },
    },
    host: {
      platform: 'win32',
      release: '10.0.26100',
      arch: 'x64',
      logicalCpuCount: 24,
      totalMemoryBytes: 68_000_000_000,
    },
  };
}

function mutate(path, value) {
  const input = validInput();
  let target = input;
  for (const key of path.slice(0, -1)) {
    target = target[key];
  }
  target[path.at(-1)] = value;
  return input;
}

test('C2.1 manifest admits only the frozen certified standalone topology', () => {
  const input = validInput();
  const manifest = buildC21ExecutionManifest(input);

  assert.equal(manifest.timingAllowed, true);
  assert.equal(manifest.comparativeClaimAllowed, false);
  assert.equal(
    manifest.certifiedControl.projectionId,
    C2_1_EXPECTED.projectionId,
  );
  assert.equal(manifest.topology.solr.runtime.coreCount, 1);
  assert.equal(manifest.topology.openSearch.runtime.nodeCount, 1);
  assert.equal(manifest.topology.openSearch.runtime.shardCount, 1);
  assert.equal(manifest.topology.openSearch.runtime.replicaCount, 0);
  assert.equal(
    manifest.topology.openSearch.runtime.resolvedPhysicalIndex,
    PHYSICAL_INDEX,
  );
  assert.equal(
    manifest.topology.openSearch.runtime.numDocs,
    C2_1_EXPECTED.projectionObjectCount,
  );
  assert.equal(manifest.executionPlan.totalBatches, 16);
  assert.equal(manifest.executionPlan.solrFirstBatches, 8);
  assert.equal(manifest.executionPlan.openSearchFirstBatches, 8);
  assert.equal(
    manifest.topology.openSearch.runtime.settingsSha256,
    sha256Json(input.openSearchRuntime.settings),
  );
});

test('C2.1 manifest accepts a stable alias resolving to one differently named physical index', () => {
  const manifest = buildC21ExecutionManifest(validInput());
  assert.equal(manifest.topology.openSearch.runtime.alias, 'discovery-comparison');
  assert.equal(
    manifest.topology.openSearch.runtime.resolvedPhysicalIndex,
    PHYSICAL_INDEX,
  );
});

test('C2.1 manifest refuses a dirty worktree', () => {
  assert.throws(
    () =>
      buildC21ExecutionManifest({
        ...validInput(),
        worktreeStatus: ' M package.json',
      }),
    /dirty Git worktree/,
  );
});

test('C2.1 manifest refuses projection drift and parity loss', () => {
  assert.throws(
    () =>
      buildC21ExecutionManifest(
        mutate(['evidence', 'projectionId'], 'd'.repeat(64)),
      ),
    /certified C2 projection identity/,
  );
  assert.throws(
    () =>
      buildC21ExecutionManifest(mutate(['evidence', 'targetParity'], false)),
    /target parity/,
  );
  assert.throws(
    () =>
      buildC21ExecutionManifest(
        mutate(['evidence', 'comparativeClaimAllowed'], true),
      ),
    /guardrail/,
  );
});

test('C2.1 manifest refuses asymmetric container CPU, memory, heap, or image tag', () => {
  assert.throws(
    () =>
      buildC21ExecutionManifest(
        mutate(['solrContainer', 'HostConfig', 'NanoCpus'], 2_000_000_000),
      ),
    /limited to 4 CPUs/,
  );
  assert.throws(
    () =>
      buildC21ExecutionManifest(
        mutate(['openSearchContainer', 'HostConfig', 'Memory'], 2 * 1024 ** 3),
      ),
    /4 GiB memory/,
  );

  const wrongHeap = validInput();
  wrongHeap.solrContainer.Config.Env = ['SOLR_HEAP=1g'];
  assert.throws(
    () => buildC21ExecutionManifest(wrongHeap),
    /SOLR_HEAP=512m/,
  );

  assert.throws(
    () =>
      buildC21ExecutionManifest(
        mutate(['openSearchContainer', 'Config', 'Image'], 'opensearchproject/opensearch:latest'),
      ),
    /must use opensearchproject\/opensearch:2\.19\.6/,
  );
});

test('C2.1 manifest refuses mutable or mismatched engine image identity', () => {
  assert.throws(
    () =>
      buildC21ExecutionManifest(
        mutate(['solrImage', 'RepoDigests'], []),
      ),
    /immutable image ID and RepoDigest/,
  );
  assert.throws(
    () =>
      buildC21ExecutionManifest(
        mutate(['openSearchImage', 'Id'], `sha256:${'9'.repeat(64)}`),
      ),
    /container image ID does not match/,
  );
});

test('C2.1 manifest proves Solr has exactly one expected core and the certified document count', () => {
  const extraCore = validInput();
  extraCore.solrRuntime.coreStatus.status.other = {
    index: { numDocs: 0 },
  };
  assert.throws(
    () => buildC21ExecutionManifest(extraCore),
    /exactly one application Solr core/,
  );

  assert.throws(
    () =>
      buildC21ExecutionManifest(
        mutate(
          ['solrRuntime', 'coreStatus', 'status', 'discovery', 'index', 'numDocs'],
          C2_1_EXPECTED.projectionObjectCount - 1,
        ),
      ),
    /Solr core must contain/,
  );
});

test('C2.1 manifest proves the OpenSearch alias resolves to one matching physical index', () => {
  const multiple = validInput();
  multiple.openSearchRuntime.settings.other = {
    settings: {
      'index.number_of_shards': '1',
      'index.number_of_replicas': '0',
    },
  };
  assert.throws(
    () => buildC21ExecutionManifest(multiple),
    /exactly one physical index/,
  );

  const mappingMismatch = validInput();
  mappingMismatch.openSearchRuntime.mapping = {
    other: { mappings: { properties: {} } },
  };
  assert.throws(
    () => buildC21ExecutionManifest(mappingMismatch),
    /settings and mapping resolved to different physical indices/,
  );
});

test('C2.1 manifest refuses OpenSearch shard, replica, version, and document-count drift', () => {
  assert.throws(
    () =>
      buildC21ExecutionManifest(
        mutate(
          ['openSearchRuntime', 'settings', PHYSICAL_INDEX, 'settings', 'index.number_of_shards'],
          '2',
        ),
      ),
    /exactly one OpenSearch shard/,
  );
  assert.throws(
    () =>
      buildC21ExecutionManifest(
        mutate(
          ['openSearchRuntime', 'settings', PHYSICAL_INDEX, 'settings', 'index.number_of_replicas'],
          '1',
        ),
      ),
    /zero OpenSearch replicas/,
  );
  assert.throws(
    () =>
      buildC21ExecutionManifest(
        mutate(['openSearchRuntime', 'root', 'version', 'number'], '2.18.0'),
      ),
    /requires OpenSearch 2\.19\.6/,
  );
  assert.throws(
    () =>
      buildC21ExecutionManifest(
        mutate(
          ['openSearchRuntime', 'count', 'count'],
          C2_1_EXPECTED.projectionObjectCount - 1,
        ),
      ),
    /OpenSearch alias must contain/,
  );
});

test('C2.1 manifest refuses failed read-state preparation', () => {
  assert.throws(
    () =>
      buildC21ExecutionManifest(
        mutate(['readState', 'solrCommit', 'responseHeader', 'status'], 1),
      ),
    /successful Solr hard commit/,
  );
  assert.throws(
    () =>
      buildC21ExecutionManifest(
        mutate(['readState', 'openSearchRefresh', '_shards', 'failed'], 1),
      ),
    /successful OpenSearch refresh/,
  );
});

test('C2.1 manifest refuses malformed commit and protocol identities', () => {
  assert.throws(
    () =>
      buildC21ExecutionManifest({ ...validInput(), repositoryCommit: 'abc' }),
    /repositoryCommit must be a 40-character Git commit SHA/,
  );
  assert.throws(
    () =>
      buildC21ExecutionManifest({ ...validInput(), protocolSha256: 'abc' }),
    /protocolSha256 must be a SHA-256 hex digest/,
  );
});
