import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { arch, cpus, platform, release, totalmem } from 'node:os';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import { buildC21RestartExecutionPlan } from './search-comparison-c2-1-foundation.mjs';

const execFileAsync = promisify(execFile);

export const C2_1_EXPECTED = Object.freeze({
  profile: 'FEDERATED_1M',
  scope: 'LOCAL_CERTIFIED_TOPOLOGY_ONLY',
  projectionId:
    '3d461a9feb49f7239f3f6aaacb0c90f1ff43d0c683238acc2202c841154db44d',
  projectionObjectCount: 1000181,
  retainedFederatedRecords: 1000000,
  solrImage: 'solr:9.10.1',
  solrVersion: '9.10.1',
  solrCore: 'discovery',
  openSearchImage: 'opensearchproject/opensearch:2.19.6',
  openSearchVersion: '2.19.6',
  openSearchAlias: 'discovery-comparison',
  heap: '512m',
  nanoCpus: 4_000_000_000,
  memoryBytes: 4 * 1024 ** 3,
  shardOrCoreCount: 1,
  replicaCount: 0,
});

const DEFAULT_BASE_URL = 'http://localhost:8080/api';
const DEFAULT_SOLR_URL = 'http://localhost:8983';
const DEFAULT_OPENSEARCH_URL = 'http://localhost:9200';
const DEFAULT_OUTPUT =
  'browser-evidence-artifacts/c2-1/execution-manifest.json';
const PROTOCOL_PATH = 'planning/C2_ADVERSARIAL_VALIDATION_PROTOCOL.md';
const COMPOSE_FILES = ['docker-compose.yml', 'docker-compose.c2-1.yml'];

function canonicalize(value) {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonicalize(value[key])]),
    );
  }
  return value;
}

export function sha256Json(value) {
  return createHash('sha256')
    .update(JSON.stringify(canonicalize(value)))
    .digest('hex');
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

function requireCommit(value, label) {
  const commit = String(value ?? '').trim();
  if (!/^[0-9a-f]{40}$/i.test(commit)) {
    throw new Error(`${label} must be a 40-character Git commit SHA.`);
  }
  return commit.toLowerCase();
}

function environmentMap(container) {
  return Object.fromEntries(
    (container?.Config?.Env ?? []).map((entry) => {
      const separator = entry.indexOf('=');
      return separator < 0
        ? [entry, '']
        : [entry.slice(0, separator), entry.slice(separator + 1)];
    }),
  );
}

function validateCertifiedEvidence(evidence) {
  if (evidence?.profile !== C2_1_EXPECTED.profile) {
    throw new Error(
      `C2.1 requires profile ${C2_1_EXPECTED.profile}; found ${evidence?.profile ?? 'missing'}.`,
    );
  }
  if (evidence?.scope !== C2_1_EXPECTED.scope) {
    throw new Error(
      `C2.1 requires evidence scope ${C2_1_EXPECTED.scope}; found ${evidence?.scope ?? 'missing'}.`,
    );
  }
  if (evidence?.projectionId !== C2_1_EXPECTED.projectionId) {
    throw new Error('C2.1 requires the certified C2 projection identity.');
  }
  if (evidence?.projectionObjectCount !== C2_1_EXPECTED.projectionObjectCount) {
    throw new Error('C2.1 requires exactly 1,000,181 projected objects.');
  }
  if (
    evidence?.retainedFederatedRecords !==
    C2_1_EXPECTED.retainedFederatedRecords
  ) {
    throw new Error('C2.1 requires exactly 1,000,000 retained federated records.');
  }
  if (evidence?.targetParity !== true) {
    throw new Error('C2.1 refuses timing without Solr/OpenSearch target parity.');
  }
  if (evidence?.comparativeClaimAllowed !== false) {
    throw new Error(
      'C2.1 requires the scoped comparative-claim guardrail to remain disabled.',
    );
  }
}

function validateContainer(service, container) {
  const isSolr = service === 'solr';
  const expectedImage = isSolr
    ? C2_1_EXPECTED.solrImage
    : C2_1_EXPECTED.openSearchImage;

  if (container?.Config?.Image !== expectedImage) {
    throw new Error(
      `C2.1 ${service} container must use ${expectedImage}; found ${container?.Config?.Image ?? 'missing'}.`,
    );
  }
  if (container?.HostConfig?.NanoCpus !== C2_1_EXPECTED.nanoCpus) {
    throw new Error(
      `C2.1 ${service} container must be limited to 4 CPUs (NanoCpus=${C2_1_EXPECTED.nanoCpus}).`,
    );
  }
  if (container?.HostConfig?.Memory !== C2_1_EXPECTED.memoryBytes) {
    throw new Error(`C2.1 ${service} container must be limited to 4 GiB memory.`);
  }

  const environment = environmentMap(container);
  if (isSolr && environment.SOLR_HEAP !== C2_1_EXPECTED.heap) {
    throw new Error('C2.1 Solr must run with SOLR_HEAP=512m.');
  }
  if (
    !isSolr &&
    environment.OPENSEARCH_JAVA_OPTS !== '-Xms512m -Xmx512m'
  ) {
    throw new Error(
      'C2.1 OpenSearch must run with -Xms512m -Xmx512m.',
    );
  }

  return {
    containerId: container.Id ?? null,
    image: container.Config.Image,
    imageId: container.Image ?? null,
    nanoCpus: container.HostConfig.NanoCpus,
    memoryBytes: container.HostConfig.Memory,
    heap: isSolr ? environment.SOLR_HEAP : environment.OPENSEARCH_JAVA_OPTS,
  };
}

function validateImage(service, containerImageId, image) {
  const repoDigests = Array.isArray(image?.RepoDigests)
    ? image.RepoDigests.filter(Boolean)
    : [];
  if (!image?.Id || repoDigests.length === 0) {
    throw new Error(
      `C2.1 ${service} image must have an immutable image ID and RepoDigest.`,
    );
  }
  if (containerImageId !== image.Id) {
    throw new Error(
      `C2.1 ${service} container image ID does not match the inspected image identity.`,
    );
  }
  return {
    imageId: image.Id,
    repoDigests,
    created: image.Created ?? null,
  };
}

function solrVersion(systemInfo) {
  return String(
    systemInfo?.lucene?.['solr-spec-version'] ??
      systemInfo?.lucene?.['solr-impl-version'] ??
      '',
  ).trim();
}

function solrJvmVersion(systemInfo) {
  return String(
    systemInfo?.jvm?.version ??
      systemInfo?.jvm?.jre?.version ??
      systemInfo?.jvm?.jre?.vendor ??
      '',
  ).trim();
}

function validateSolrRuntime({ systemInfo, coreStatus, config, schema }) {
  const version = solrVersion(systemInfo);
  if (!version.startsWith(C2_1_EXPECTED.solrVersion)) {
    throw new Error(
      `C2.1 requires Solr ${C2_1_EXPECTED.solrVersion}; live Solr reports ${version || 'missing version'}.`,
    );
  }

  const statuses = coreStatus?.status ?? {};
  const names = Object.keys(statuses).sort();
  if (
    names.length !== C2_1_EXPECTED.shardOrCoreCount ||
    names[0] !== C2_1_EXPECTED.solrCore
  ) {
    throw new Error(
      `C2.1 requires exactly one application Solr core named ${C2_1_EXPECTED.solrCore}.`,
    );
  }

  const core = statuses[C2_1_EXPECTED.solrCore];
  const numDocs = Number(core?.index?.numDocs);
  if (numDocs !== C2_1_EXPECTED.projectionObjectCount) {
    throw new Error(
      `C2.1 Solr core must contain ${C2_1_EXPECTED.projectionObjectCount} documents; found ${numDocs}.`,
    );
  }

  const jvmVersion = solrJvmVersion(systemInfo);
  if (!jvmVersion) {
    throw new Error('C2.1 requires live Solr JVM version metadata.');
  }

  return {
    version,
    jvmVersion,
    coreCount: names.length,
    replicaCount: 0,
    core: C2_1_EXPECTED.solrCore,
    numDocs,
    indexVersion: core?.index?.version ?? null,
    indexCurrent: core?.index?.current ?? null,
    startTime: core?.startTime ?? null,
    uptimeMs: core?.uptime ?? null,
    configSha256: sha256Json(config),
    schemaSha256: sha256Json(schema),
  };
}

function singleOpenSearchNode(nodesJvm) {
  const entries = Object.entries(nodesJvm?.nodes ?? {});
  if (entries.length !== 1) {
    throw new Error('C2.1 requires exactly one OpenSearch node.');
  }
  return entries[0];
}

function singleOpenSearchIndex(document, label) {
  const entries = Object.entries(document ?? {});
  if (entries.length !== 1) {
    throw new Error(
      `C2.1 ${label} must resolve alias ${C2_1_EXPECTED.openSearchAlias} to exactly one physical index.`,
    );
  }
  return entries[0];
}

function setting(settings, key) {
  return settings[key] ?? settings.index?.[key.replace(/^index\./, '')];
}

function validateOpenSearchRuntime({
  root,
  nodesJvm,
  settings,
  mapping,
  count,
}) {
  const version = String(root?.version?.number ?? '').trim();
  if (version !== C2_1_EXPECTED.openSearchVersion) {
    throw new Error(
      `C2.1 requires OpenSearch ${C2_1_EXPECTED.openSearchVersion}; live OpenSearch reports ${version || 'missing version'}.`,
    );
  }

  const [, node] = singleOpenSearchNode(nodesJvm);
  const jvmVersion = String(
    node?.jvm?.version ?? node?.jvm?.vm_version ?? '',
  ).trim();
  if (!jvmVersion) {
    throw new Error('C2.1 requires live OpenSearch JVM version metadata.');
  }

  const [resolvedIndex, settingsNode] = singleOpenSearchIndex(
    settings,
    'settings response',
  );
  const [mappingIndex] = singleOpenSearchIndex(mapping, 'mapping response');
  if (mappingIndex !== resolvedIndex) {
    throw new Error(
      'C2.1 OpenSearch settings and mapping resolved to different physical indices.',
    );
  }
  if (!settingsNode?.settings) {
    throw new Error('C2.1 OpenSearch settings response is missing index settings.');
  }

  const indexSettings = settingsNode.settings;
  const shards = Number(setting(indexSettings, 'index.number_of_shards'));
  const replicas = Number(setting(indexSettings, 'index.number_of_replicas'));
  if (shards !== C2_1_EXPECTED.shardOrCoreCount) {
    throw new Error('C2.1 requires exactly one OpenSearch shard.');
  }
  if (replicas !== C2_1_EXPECTED.replicaCount) {
    throw new Error('C2.1 requires zero OpenSearch replicas.');
  }

  const documentCount = Number(count?.count);
  if (documentCount !== C2_1_EXPECTED.projectionObjectCount) {
    throw new Error(
      `C2.1 OpenSearch alias must contain ${C2_1_EXPECTED.projectionObjectCount} documents; found ${documentCount}.`,
    );
  }

  const refreshInterval = String(
    setting(indexSettings, 'index.refresh_interval') ?? 'default',
  );

  return {
    version,
    jvmVersion,
    nodeCount: 1,
    shardCount: shards,
    replicaCount: replicas,
    alias: C2_1_EXPECTED.openSearchAlias,
    resolvedPhysicalIndex: resolvedIndex,
    numDocs: documentCount,
    refreshInterval,
    settingsSha256: sha256Json(settings),
    mappingSha256: sha256Json(mapping),
  };
}

function validateReadState(readState) {
  if (Number(readState?.solrCommit?.responseHeader?.status) !== 0) {
    throw new Error('C2.1 requires a successful Solr hard commit before timing.');
  }
  if (Number(readState?.openSearchRefresh?._shards?.failed ?? 1) !== 0) {
    throw new Error('C2.1 requires a successful OpenSearch refresh before timing.');
  }
  return {
    solrHardCommit: 'SUCCESS',
    openSearchRefresh: 'SUCCESS',
    preparedAt: readState.preparedAt,
  };
}

export function buildC21ExecutionManifest({
  capturedAt,
  repositoryCommit,
  protocolCommit,
  protocolSha256,
  worktreeStatus = '',
  dockerVersion,
  evidence,
  solrContainer,
  openSearchContainer,
  solrImage,
  openSearchImage,
  solrRuntime,
  openSearchRuntime,
  readState,
  host,
} = {}) {
  if (String(worktreeStatus).trim() !== '') {
    throw new Error(
      'C2.1 refuses timing from a dirty Git worktree; commit or stash changes first.',
    );
  }

  validateCertifiedEvidence(evidence);
  const repositorySha = requireCommit(repositoryCommit, 'repositoryCommit');
  const protocolSha = requireCommit(protocolCommit, 'protocolCommit');
  if (!/^[0-9a-f]{64}$/i.test(String(protocolSha256 ?? ''))) {
    throw new Error('protocolSha256 must be a SHA-256 hex digest.');
  }
  if (!dockerVersion || typeof dockerVersion !== 'object') {
    throw new Error('C2.1 requires Docker server version metadata.');
  }
  if (!host || typeof host !== 'object') {
    throw new Error('C2.1 requires host runtime metadata.');
  }

  const solrContainerRuntime = validateContainer('solr', solrContainer);
  const openSearchContainerRuntime = validateContainer(
    'opensearch',
    openSearchContainer,
  );
  const solrImageIdentity = validateImage(
    'solr',
    solrContainerRuntime.imageId,
    solrImage,
  );
  const openSearchImageIdentity = validateImage(
    'opensearch',
    openSearchContainerRuntime.imageId,
    openSearchImage,
  );
  const liveSolr = validateSolrRuntime(solrRuntime);
  const liveOpenSearch = validateOpenSearchRuntime(openSearchRuntime);
  const preparedReadState = validateReadState(readState);
  const executionPlan = buildC21RestartExecutionPlan();

  return {
    experiment: 'C2.1_ADVERSARIAL_STANDALONE',
    capturedAt,
    timingAllowed: true,
    comparativeClaimAllowed: false,
    protocol: {
      path: PROTOCOL_PATH,
      commit: protocolSha,
      sha256: String(protocolSha256).toLowerCase(),
    },
    repositoryCommit: repositorySha,
    certifiedControl: {
      profile: evidence.profile,
      scope: evidence.scope,
      projectionId: evidence.projectionId,
      projectionObjectCount: evidence.projectionObjectCount,
      retainedFederatedRecords: evidence.retainedFederatedRecords,
      targetParity: evidence.targetParity,
    },
    topology: {
      kind: 'DOCKER_COMPOSE_STANDALONE',
      composeFiles: [...COMPOSE_FILES],
      dockerVersion,
      solr: {
        ...solrContainerRuntime,
        immutableImage: solrImageIdentity,
        runtime: liveSolr,
      },
      openSearch: {
        ...openSearchContainerRuntime,
        immutableImage: openSearchImageIdentity,
        runtime: liveOpenSearch,
      },
    },
    readState: preparedReadState,
    host,
    executionPlan,
    guardrail:
      'This manifest authorizes C2.1 timing only for the exact certified C2 corpus/projection and the documented standalone resource-controlled topology. It does not authorize a universal Solr/OpenSearch winner claim.',
  };
}

async function command(execFileImpl, executable, args) {
  const result = await execFileImpl(executable, args, {
    maxBuffer: 16 * 1024 * 1024,
  });
  return String(result.stdout ?? '').trim();
}

async function fetchJson(fetchImpl, url, init) {
  const response = await fetchImpl(url, init);
  if (!response.ok) {
    throw new Error(
      `C2.1 runtime preflight failed: ${url} returned HTTP ${response.status}.`,
    );
  }
  return response.json();
}

async function dockerInspect(execFileImpl, containerId) {
  const output = await command(execFileImpl, 'docker', ['inspect', containerId]);
  const [inspection] = parseJsonDocuments(output);
  if (!inspection) {
    throw new Error(`Docker inspect returned no data for ${containerId}.`);
  }
  return inspection;
}

async function dockerImageInspect(execFileImpl, imageId) {
  const output = await command(execFileImpl, 'docker', [
    'image',
    'inspect',
    imageId,
  ]);
  const [inspection] = parseJsonDocuments(output);
  if (!inspection) {
    throw new Error(`Docker image inspect returned no data for ${imageId}.`);
  }
  return inspection;
}

async function prepareReadState({
  fetchImpl,
  solrUrl,
  openSearchUrl,
  now,
}) {
  const solrCommit = await fetchJson(
    fetchImpl,
    `${solrUrl}/solr/${C2_1_EXPECTED.solrCore}/update?commit=true&wt=json`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    },
  );
  const openSearchRefresh = await fetchJson(
    fetchImpl,
    `${openSearchUrl}/${C2_1_EXPECTED.openSearchAlias}/_refresh`,
    { method: 'POST' },
  );
  return {
    preparedAt: now().toISOString(),
    solrCommit,
    openSearchRefresh,
  };
}

export async function captureC21ExecutionManifest({
  fetchImpl = fetch,
  execFileImpl = execFileAsync,
  baseUrl = DEFAULT_BASE_URL,
  solrUrl = DEFAULT_SOLR_URL,
  openSearchUrl = DEFAULT_OPENSEARCH_URL,
  now = () => new Date(),
} = {}) {
  const evidence = await fetchJson(
    fetchImpl,
    `${baseUrl.replace(/\/$/, '')}/evidence/search-performance`,
  );

  const [repositoryCommit, protocolCommit, worktreeStatus, dockerVersionText] =
    await Promise.all([
      command(execFileImpl, 'git', ['rev-parse', 'HEAD']),
      command(execFileImpl, 'git', [
        'log',
        '-1',
        '--format=%H',
        '--',
        PROTOCOL_PATH,
      ]),
      command(execFileImpl, 'git', ['status', '--porcelain']),
      command(execFileImpl, 'docker', [
        'version',
        '--format',
        '{{json .Server}}',
      ]),
    ]);

  const protocolContent = await readFile(PROTOCOL_PATH);
  const protocolSha256 = createHash('sha256')
    .update(protocolContent)
    .digest('hex');

  const composePs = parseJsonDocuments(
    await command(execFileImpl, 'docker', [
      'compose',
      '-f',
      COMPOSE_FILES[0],
      '-f',
      COMPOSE_FILES[1],
      'ps',
      '--format',
      'json',
      'solr',
      'opensearch',
    ]),
  );
  const serviceEntry = (service) =>
    composePs.find((entry) => (entry.Service ?? entry.service) === service);
  const solrEntry = serviceEntry('solr');
  const openSearchEntry = serviceEntry('opensearch');
  if (!solrEntry || !openSearchEntry) {
    throw new Error(
      'C2.1 requires running solr and opensearch containers from the C2.1 Compose topology.',
    );
  }

  const solrContainer = await dockerInspect(
    execFileImpl,
    solrEntry.ID ?? solrEntry.Id ?? solrEntry.id,
  );
  const openSearchContainer = await dockerInspect(
    execFileImpl,
    openSearchEntry.ID ?? openSearchEntry.Id ?? openSearchEntry.id,
  );
  const [solrImage, openSearchImage] = await Promise.all([
    dockerImageInspect(execFileImpl, solrContainer.Image),
    dockerImageInspect(execFileImpl, openSearchContainer.Image),
  ]);

  const readState = await prepareReadState({
    fetchImpl,
    solrUrl,
    openSearchUrl,
    now,
  });

  const [solrSystem, solrCoreStatus, solrConfig, solrSchema] =
    await Promise.all([
      fetchJson(fetchImpl, `${solrUrl}/solr/admin/info/system?wt=json`),
      fetchJson(
        fetchImpl,
        `${solrUrl}/solr/admin/cores?action=STATUS&wt=json`,
      ),
      fetchJson(
        fetchImpl,
        `${solrUrl}/solr/${C2_1_EXPECTED.solrCore}/config?wt=json&omitHeader=true`,
      ),
      fetchJson(
        fetchImpl,
        `${solrUrl}/solr/${C2_1_EXPECTED.solrCore}/schema?wt=json&omitHeader=true`,
      ),
    ]);

  const aliasUrl = `${openSearchUrl}/${C2_1_EXPECTED.openSearchAlias}`;
  const [
    openSearchRoot,
    openSearchNodesJvm,
    openSearchSettings,
    openSearchMapping,
    openSearchCount,
  ] = await Promise.all([
    fetchJson(fetchImpl, openSearchUrl),
    fetchJson(fetchImpl, `${openSearchUrl}/_nodes/jvm`),
    fetchJson(
      fetchImpl,
      `${aliasUrl}/_settings?include_defaults=true&flat_settings=true`,
    ),
    fetchJson(fetchImpl, `${aliasUrl}/_mapping`),
    fetchJson(fetchImpl, `${aliasUrl}/_count`),
  ]);

  return buildC21ExecutionManifest({
    capturedAt: now().toISOString(),
    repositoryCommit,
    protocolCommit,
    protocolSha256,
    worktreeStatus,
    dockerVersion: JSON.parse(dockerVersionText),
    evidence,
    solrContainer,
    openSearchContainer,
    solrImage,
    openSearchImage,
    solrRuntime: {
      systemInfo: solrSystem,
      coreStatus: solrCoreStatus,
      config: solrConfig,
      schema: solrSchema,
    },
    openSearchRuntime: {
      root: openSearchRoot,
      nodesJvm: openSearchNodesJvm,
      settings: openSearchSettings,
      mapping: openSearchMapping,
      count: openSearchCount,
    },
    readState,
    host: {
      platform: platform(),
      release: release(),
      arch: arch(),
      logicalCpuCount: cpus().length,
      totalMemoryBytes: totalmem(),
    },
  });
}

export async function writeC21ExecutionManifest({
  output = DEFAULT_OUTPUT,
  ...options
} = {}) {
  const manifest = await captureC21ExecutionManifest(options);
  const outputPath = resolve(output);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  return { manifest, outputPath };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  writeC21ExecutionManifest()
    .then(({ manifest, outputPath }) => {
      console.log(
        `C2.1 execution manifest READY: ${outputPath}\nprotocol ${manifest.protocol.commit}\nprojection ${manifest.certifiedControl.projectionId}\norders ${manifest.executionPlan.solrFirstBatches}/${manifest.executionPlan.openSearchFirstBatches}`,
      );
    })
    .catch((error) => {
      console.error(`C2.1 execution manifest REFUSED: ${error.message}`);
      process.exitCode = 1;
    });
}
