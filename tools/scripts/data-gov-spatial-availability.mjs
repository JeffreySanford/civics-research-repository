import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_OUTPUT_DIR = 'browser-evidence-artifacts/spatial-availability';
const DEFAULT_SEARCH_URL = 'https://api.gsa.gov/technology/datagov/v4/search';
const DEFAULT_PAGE_SIZE = 1_000;
const DEFAULT_MAX_PAGES = 2_000;
const C2_PROFILE = 'FEDERATED_1M';
const C2_TARGET_RECORDS = 1_000_000;
const SHA256 = /^[0-9a-f]{64}$/u;
const REQUIRED_SCALE_CHECKS = [
  'preflight-ready-to-measure',
  'exact-source-recipe',
  'scale-evidence-valid',
  'active-profile',
  'persisted-activation-runtime-identity',
  'search-target-parity',
  'storage-evidence',
  'composition-projection-linkage',
  'public-search-data_gov-provenance',
  'public-search-doe_osti-provenance',
];

/**
 * Read-only query that returns the exact retained Data.gov source identifiers.
 *
 * The prior probe incorrectly treated sourceMetadata.harvestRecordRaw as retained raw JSON. Data.gov
 * Catalog API v4 defines that field as a URL to a separate raw-record endpoint, so availability must
 * be measured from the source search representation and intersected with this certified retained set.
 */
export function buildRetainedIdentifiersSql() {
  return `
select source_identifier
from federated_research_objects
where source_system = 'DATA_GOV'
order by source_identifier;
`.trim();
}

export function parsePsqlIdentifiers(stdout) {
  return new Set(
    String(stdout)
      .split(/\r?\n/u)
      .map((line) => line.trim())
      .filter(Boolean),
  );
}

export function buildDataGovSpatialSearchUrl({
  searchUrl = DEFAULT_SEARCH_URL,
  cursor = null,
  pageSize = DEFAULT_PAGE_SIZE,
}) {
  const safePageSize = Math.max(
    1,
    Math.min(Number(pageSize) || DEFAULT_PAGE_SIZE, DEFAULT_PAGE_SIZE),
  );
  const url = new URL(searchUrl);
  url.searchParams.set('per_page', String(safePageSize));
  url.searchParams.set('sort', 'last_harvested_date');
  url.searchParams.set('spatial_filter', 'geospatial');
  if (cursor) {
    url.searchParams.set('after', cursor);
  }
  return url;
}

export function normalizeScaleCertification(raw) {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Scale evidence must be a JSON object.');
  }
  if (raw.kind !== 'civics-scale-evidence-check') {
    throw new Error('Scale evidence kind must be civics-scale-evidence-check.');
  }
  if (raw.profile !== C2_PROFILE) {
    throw new Error(`Scale evidence profile must be ${C2_PROFILE}.`);
  }
  if (raw.status !== 'PASS') {
    throw new Error(
      'Scale evidence must be PASS before spatial evidence is captured.',
    );
  }

  const targetFederatedRecordCount = nonNegativeInteger(
    raw.targetFederatedRecordCount,
    'scale targetFederatedRecordCount',
  );
  if (targetFederatedRecordCount !== C2_TARGET_RECORDS) {
    throw new Error(
      `Scale evidence must target exactly ${C2_TARGET_RECORDS.toLocaleString('en-US')} federated records.`,
    );
  }

  const retainedFederatedRecordCount = nonNegativeInteger(
    raw.retainedFederatedRecordCount,
    'scale retainedFederatedRecordCount',
  );
  if (retainedFederatedRecordCount < C2_TARGET_RECORDS) {
    throw new Error(
      `Scale evidence retained count must be at least ${C2_TARGET_RECORDS.toLocaleString('en-US')}.`,
    );
  }

  const compositionSha256 = sha256(
    raw.compositionSha256,
    'scale compositionSha256',
  );
  const projectionId = sha256(raw.projectionId, 'scale projectionId');
  const projectionObjectCount = nonNegativeInteger(
    raw.projectionObjectCount,
    'scale projectionObjectCount',
  );
  if (projectionObjectCount === 0) {
    throw new Error('Scale projectionObjectCount must be greater than zero.');
  }

  const capturedAt = requiredText(raw.capturedAt, 'scale capturedAt');
  const checks = new Map(
    (Array.isArray(raw.checks) ? raw.checks : []).map((entry) => [
      entry?.id,
      entry?.status,
    ]),
  );
  const missingPassChecks = REQUIRED_SCALE_CHECKS.filter(
    (id) => checks.get(id) !== 'PASS',
  );
  if (missingPassChecks.length > 0) {
    throw new Error(
      `Scale evidence is missing required PASS checks: ${missingPassChecks.join(', ')}.`,
    );
  }

  return {
    kind: 'c2-scale-certification',
    profile: C2_PROFILE,
    capturedAt,
    compositionSha256,
    projectionId,
    projectionObjectCount,
    retainedFederatedRecordCount,
  };
}

export async function loadScaleCertification(scaleEvidencePath) {
  const resolved = path.resolve(scaleEvidencePath);
  let raw;
  try {
    raw = JSON.parse(await readFile(resolved, 'utf8'));
  } catch (error) {
    throw new Error(`Unable to read valid scale evidence JSON: ${resolved}`, {
      cause: error,
    });
  }
  return normalizeScaleCertification(raw);
}

export function requirePersonalDataGovApiKey(env = process.env) {
  const apiKey = String(env.CIVICS_FEDERATION_DATA_GOV_API_KEY ?? '').trim();
  if (
    !apiKey ||
    apiKey === 'DEMO_KEY' ||
    /YOUR_API_DATA_GOV_KEY_HERE/iu.test(apiKey)
  ) {
    throw new Error(
      'A personal CIVICS_FEDERATION_DATA_GOV_API_KEY is required for the full Data.gov spatial probe; DEMO_KEY is intentionally limited to tiny exploratory calls.',
    );
  }
  return apiKey;
}

export async function probeDataGovSpatialSource({
  retainedIdentifiers,
  apiKey,
  fetchImpl = globalThis.fetch,
  searchUrl = DEFAULT_SEARCH_URL,
  pageSize = DEFAULT_PAGE_SIZE,
  maxPages = DEFAULT_MAX_PAGES,
  sampleLimit = 10,
}) {
  if (!(retainedIdentifiers instanceof Set)) {
    throw new Error('retainedIdentifiers must be a Set.');
  }
  if (!apiKey || !String(apiKey).trim()) {
    throw new Error('apiKey is required.');
  }
  if (typeof fetchImpl !== 'function') {
    throw new Error('fetchImpl must be a function.');
  }

  const safePageSize = positiveInteger(
    pageSize,
    'pageSize',
    DEFAULT_PAGE_SIZE,
  );
  const safeMaxPages = positiveInteger(
    maxPages,
    'maxPages',
    DEFAULT_MAX_PAGES,
  );
  const seenSourceIdentifiers = new Set();
  const matchedIdentifiers = new Set();
  const samples = [];
  let cursor = null;
  let pages = 0;
  let dcatSpatialMatches = 0;
  let spatialShapeMatches = 0;
  let spatialCentroidMatches = 0;
  let hasSpatialTrueMatches = 0;

  while (true) {
    if (pages >= safeMaxPages) {
      throw new Error(
        `Data.gov spatial probe reached maxPages=${safeMaxPages} before the source cursor completed.`,
      );
    }

    const url = buildDataGovSpatialSearchUrl({
      searchUrl,
      cursor,
      pageSize: safePageSize,
    });
    const response = await fetchImpl(url, {
      headers: {
        Accept: 'application/json',
        'X-Api-Key': String(apiKey).trim(),
      },
    });

    if (response.status === 429) {
      const retryAfter = response.headers?.get?.('retry-after');
      throw new Error(
        `Data.gov spatial probe hit HTTP 429 rate limiting${retryAfter ? `; retry after ${retryAfter}` : ''}.`,
      );
    }
    if (!response.ok) {
      throw new Error(
        `Data.gov spatial probe request failed with HTTP ${response.status}: ${url}`,
      );
    }

    const page = await response.json();
    const results = Array.isArray(page?.results) ? page.results : null;
    if (!results) {
      throw new Error('Data.gov spatial search response is missing results.');
    }
    pages += 1;

    for (const dataset of results) {
      const identifier = sourceIdentifier(dataset);
      if (!identifier) {
        throw new Error(
          'Data.gov spatial search returned a record without a stable identifier.',
        );
      }
      if (seenSourceIdentifiers.has(identifier)) {
        throw new Error(
          `Data.gov spatial search repeated identifier ${identifier}.`,
        );
      }
      seenSourceIdentifiers.add(identifier);

      if (!retainedIdentifiers.has(identifier)) {
        continue;
      }
      matchedIdentifiers.add(identifier);
      const dcatSpatial = textValue(dataset?.dcat?.spatial);
      const shape = objectValue(dataset?.spatial_shape);
      const centroid = objectValue(dataset?.spatial_centroid);
      if (dcatSpatial) dcatSpatialMatches += 1;
      if (shape) spatialShapeMatches += 1;
      if (centroid) spatialCentroidMatches += 1;
      if (dataset?.has_spatial === true) hasSpatialTrueMatches += 1;

      if (samples.length < sampleLimit) {
        samples.push({
          identifier,
          title: textValue(dataset?.title) ?? null,
          dcatSpatial: dcatSpatial ?? null,
          spatialShapeType: textValue(shape?.type) ?? null,
          spatialCentroidType: textValue(centroid?.type) ?? null,
          hasSpatial: dataset?.has_spatial === true,
        });
      }
    }

    const nextCursor = textValue(page?.after);
    if (!nextCursor) {
      break;
    }
    if (results.length === 0) {
      throw new Error(
        'Data.gov spatial search returned an empty page with a continuation cursor.',
      );
    }
    cursor = nextCursor;
  }

  const retainedRecordCount = retainedIdentifiers.size;
  const retainedSpatialRecordCount = matchedIdentifiers.size;
  return {
    method: 'data-gov-v4-geospatial-search-intersection',
    searchUrl,
    spatialFilter: 'geospatial',
    pageSize: Math.min(safePageSize, DEFAULT_PAGE_SIZE),
    pagesFetched: pages,
    sourceSpatialRecordCount: seenSourceIdentifiers.size,
    retainedRecordCount,
    retainedSpatialRecordCount,
    retainedSpatialPercent:
      retainedRecordCount === 0
        ? 0
        : Number(
            ((retainedSpatialRecordCount / retainedRecordCount) * 100).toFixed(
              4,
            ),
          ),
    unmatchedCurrentSourceSpatialRecords:
      seenSourceIdentifiers.size - retainedSpatialRecordCount,
    matchedMetadataSignals: {
      hasSpatialTrue: hasSpatialTrueMatches,
      dcatSpatial: dcatSpatialMatches,
      spatialShape: spatialShapeMatches,
      spatialCentroid: spatialCentroidMatches,
    },
    samples,
  };
}

export function formatMarkdown(report, expectedCount = null) {
  const expectedLine =
    expectedCount === null
      ? ''
      : `\n- Expected retained Data.gov records: **${expectedCount.toLocaleString()}** (${report.retainedRecordCount === expectedCount ? 'MATCH' : 'MISMATCH'})`;
  const certification = report.scaleCertification;
  const certificationBlock = certification
    ? `\n## Certified C2 binding\n\n- Profile: \`${certification.profile}\`\n- Scale evidence captured: ${certification.capturedAt}\n- Composition SHA-256: \`${certification.compositionSha256}\`\n- Projection ID: \`${certification.projectionId}\`\n- Projection objects: **${certification.projectionObjectCount.toLocaleString()}**\n- Retained federated records: **${certification.retainedFederatedRecordCount.toLocaleString()}**\n`
    : '';

  const sampleRows = report.samples.length
    ? report.samples
        .map(
          (sample) =>
            `| \`${sample.identifier}\` | ${escapeMarkdown(sample.title ?? '')} | ${escapeMarkdown(sample.dcatSpatial ?? '')} | ${sample.spatialShapeType ?? ''} |`,
        )
        .join('\n')
    : '| _none_ |  |  |  |';

  return `# Data.gov spatial availability evidence\n\n- Captured: ${report.capturedAt}\n- Method: **Data.gov v4 geospatial search intersected with certified retained C2 identifiers**\n- Retained Data.gov identifiers: **${report.retainedRecordCount.toLocaleString()}**${expectedLine}\n- Current Data.gov geospatial records traversed: **${report.sourceSpatialRecordCount.toLocaleString()}**\n- Retained C2 identifiers with current explicit geospatial metadata: **${report.retainedSpatialRecordCount.toLocaleString()}** (${report.retainedSpatialPercent}%)\n- Current geospatial source records outside retained C2: **${report.unmatchedCurrentSourceSpatialRecords.toLocaleString()}**\n- Data.gov pages fetched: **${report.pagesFetched.toLocaleString()}**\n${certificationBlock}\n## Matched metadata signals\n\n| Signal | Retained C2 matches |\n| --- | ---: |\n| \`has_spatial = true\` | ${report.matchedMetadataSignals.hasSpatialTrue.toLocaleString()} |\n| \`dcat.spatial\` | ${report.matchedMetadataSignals.dcatSpatial.toLocaleString()} |\n| \`spatial_shape\` | ${report.matchedMetadataSignals.spatialShape.toLocaleString()} |\n| \`spatial_centroid\` | ${report.matchedMetadataSignals.spatialCentroid.toLocaleString()} |\n\n## Bounded samples\n\n| Identifier | Title | DCAT spatial | Shape type |\n| --- | --- | --- | --- |\n${sampleRows}\n\n## Interpretation\n\nThis measurement uses the current Data.gov Catalog API v4 source representation and intersects those geospatial results with the exact Data.gov identifiers retained in certified C2. It does **not** claim the current source snapshot is byte-for-byte historical C2 metadata. Spatial values still require validation and typed, versioned sidecar enrichment before map rendering.\n\nThe prior retained-link probe is intentionally superseded: Data.gov v4 \`harvest_record_raw\` is a URL to a separate raw-record endpoint, not retained raw JSON, so searching that URL string for a \`spatial\` token cannot measure spatial availability.\n\nThis probe is read-only. It does not mutate the certified corpus, activation state, search projection, or Data.gov source metadata.\n`;
}

export function parseArgs(argv) {
  const args = {
    expectedCount: null,
    outputDir: DEFAULT_OUTPUT_DIR,
    scaleEvidencePath: null,
    searchUrl: DEFAULT_SEARCH_URL,
    pageSize: DEFAULT_PAGE_SIZE,
    maxPages: DEFAULT_MAX_PAGES,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--') continue;
    if (argument === '--expect') {
      args.expectedCount = nonNegativeInteger(argv[index + 1], '--expect');
      index += 1;
      continue;
    }
    if (argument === '--output-dir') {
      args.outputDir = requiredText(argv[index + 1], '--output-dir');
      index += 1;
      continue;
    }
    if (argument === '--scale-evidence') {
      args.scaleEvidencePath = requiredText(
        argv[index + 1],
        '--scale-evidence',
      );
      index += 1;
      continue;
    }
    if (argument === '--search-url') {
      args.searchUrl = requiredText(argv[index + 1], '--search-url');
      index += 1;
      continue;
    }
    if (argument === '--page-size') {
      args.pageSize = positiveInteger(
        argv[index + 1],
        '--page-size',
        DEFAULT_PAGE_SIZE,
      );
      index += 1;
      continue;
    }
    if (argument === '--max-pages') {
      args.maxPages = positiveInteger(
        argv[index + 1],
        '--max-pages',
        DEFAULT_MAX_PAGES,
      );
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${argument}`);
  }
  return args;
}

export function runPsqlIdentifiers(sql, env = process.env) {
  const database = env.CIVICS_DB_NAME || 'civics_ops';
  const user = env.CIVICS_DB_USER || 'civics';
  const result = spawnSync(
    'docker',
    [
      'compose',
      'exec',
      '-T',
      'postgres',
      'psql',
      '-X',
      '-A',
      '-t',
      '-q',
      '-U',
      user,
      '-d',
      database,
      '-c',
      sql,
    ],
    { encoding: 'utf8', env, maxBuffer: 256 * 1024 * 1024 },
  );

  if (result.error) {
    throw new Error(
      `Unable to read retained Data.gov identifiers: ${result.error.message}`,
      { cause: result.error },
    );
  }
  if (result.status !== 0) {
    throw new Error(
      `Data.gov retained-identifier query failed (exit ${result.status}).\n${result.stderr || result.stdout}`,
    );
  }
  return result.stdout;
}

export async function run(argv = process.argv.slice(2), env = process.env) {
  const {
    expectedCount,
    outputDir,
    scaleEvidencePath,
    searchUrl,
    pageSize,
    maxPages,
  } = parseArgs(argv);
  const scaleCertification = scaleEvidencePath
    ? await loadScaleCertification(scaleEvidencePath)
    : null;
  const retainedIdentifiers = parsePsqlIdentifiers(
    runPsqlIdentifiers(buildRetainedIdentifiersSql(), env),
  );
  if (expectedCount !== null && retainedIdentifiers.size !== expectedCount) {
    throw new Error(
      `Retained Data.gov identifier count ${retainedIdentifiers.size.toLocaleString()} does not match expected ${expectedCount.toLocaleString()}.`,
    );
  }

  const apiKey = requirePersonalDataGovApiKey(env);
  const probe = await probeDataGovSpatialSource({
    retainedIdentifiers,
    apiKey,
    searchUrl,
    pageSize,
    maxPages,
  });
  const report = {
    ...probe,
    capturedAt: new Date().toISOString(),
    ...(scaleCertification ? { scaleCertification } : {}),
  };

  const resolvedOutputDir = path.resolve(outputDir);
  await mkdir(resolvedOutputDir, { recursive: true });
  const jsonPath = path.join(
    resolvedOutputDir,
    'data-gov-spatial-availability.json',
  );
  const markdownPath = path.join(
    resolvedOutputDir,
    'data-gov-spatial-availability.md',
  );
  await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  await writeFile(markdownPath, formatMarkdown(report, expectedCount), 'utf8');

  console.log(formatMarkdown(report, expectedCount));
  console.log(`JSON evidence: ${jsonPath}`);
  console.log(`Markdown evidence: ${markdownPath}`);
  return report;
}

function sourceIdentifier(dataset) {
  return textValue(dataset?.identifier) ?? textValue(dataset?.dcat?.identifier);
}

function textValue(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function objectValue(value) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value
    : null;
}

function escapeMarkdown(value) {
  return String(value).replaceAll('|', '\\|').replaceAll('\n', ' ');
}

function nonNegativeInteger(value, name) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error(`${name} must be a non-negative integer.`);
  }
  return parsed;
}

function positiveInteger(value, name, max) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0 || parsed > max) {
    throw new Error(`${name} must be an integer from 1 through ${max}.`);
  }
  return parsed;
}

function requiredText(value, name) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${name} must be a non-empty string.`);
  }
  return value.trim();
}

function sha256(value, name) {
  if (typeof value !== 'string' || !SHA256.test(value)) {
    throw new Error(`${name} must be a lowercase SHA-256 value.`);
  }
  return value;
}

const invokedDirectly =
  process.argv[1] &&
  path.resolve(process.argv[1]) ===
    path.resolve(fileURLToPath(import.meta.url));
if (invokedDirectly) {
  await run();
}
