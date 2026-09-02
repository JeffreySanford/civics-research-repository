import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const DEFAULT_BASE_URL = 'http://localhost:8080/api';
const DEFAULT_PROFILE = 'FEDERATED_1M';
const DEFAULT_PAGE_SIZE = 100;
const DEFAULT_PASSES = 2;
const DEFAULT_MAX_PAGES = 20000;
const DEFAULT_OUTPUT =
  'browser-evidence-artifacts/cursor-traversal/federated-1m-cursor-traversal.json';

function asInteger(value, fallback = null) {
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : fallback;
}

function isSha256(value) {
  return typeof value === 'string' && /^[0-9a-f]{64}$/u.test(value);
}

function check(id, pass, detail) {
  return { id, status: pass ? 'PASS' : 'FAIL', detail };
}

async function fetchJson(fetchImpl, url) {
  const response = await fetchImpl(url);
  if (!response.ok) {
    throw new Error(`Request failed with HTTP ${response.status}: ${url}`);
  }
  return response.json();
}

function cursorUrl(root, pageSize, cursor) {
  const url = new URL(`${root}/search/cursor`);
  url.searchParams.set('pageSize', String(pageSize));
  if (cursor) {
    url.searchParams.set('cursor', cursor);
  }
  return url.toString();
}

export async function traverseCursor({
  fetchImpl = globalThis.fetch,
  baseUrl = DEFAULT_BASE_URL,
  pageSize = DEFAULT_PAGE_SIZE,
  maxPages = DEFAULT_MAX_PAGES,
} = {}) {
  const root = baseUrl.replace(/\/$/u, '');
  const seenIds = new Set();
  const seenCursors = new Set();
  const duplicateIds = [];
  const orderedIdHash = createHash('sha256');
  let cursor = null;
  let pageCount = 0;
  let returnedCount = 0;
  let totalResults = null;
  let resultSource = null;

  while (true) {
    if (pageCount >= maxPages) {
      throw new Error(
        `Cursor traversal exceeded the ${maxPages.toLocaleString('en-US')} page safety limit.`,
      );
    }

    const cursorPage = await fetchJson(
      fetchImpl,
      cursorUrl(root, pageSize, cursor),
    );
    const search = cursorPage?.search;
    if (!search || !Array.isArray(search.results)) {
      throw new Error(
        'Cursor search returned an invalid SearchCursorPage payload.',
      );
    }

    const logicalPage = asInteger(search.page);
    if (logicalPage !== pageCount) {
      throw new Error(
        `Cursor traversal expected logical page ${pageCount}, received ${logicalPage ?? 'missing'}.`,
      );
    }

    const observedTotal = asInteger(search.totalResults);
    if (observedTotal === null || observedTotal < 0) {
      throw new Error('Cursor search returned an invalid totalResults value.');
    }
    if (totalResults === null) {
      totalResults = observedTotal;
      resultSource = search.resultSource ?? null;
    } else if (observedTotal !== totalResults) {
      throw new Error(
        `Cursor traversal totalResults changed from ${totalResults} to ${observedTotal}.`,
      );
    }

    for (const result of search.results) {
      const id = typeof result?.id === 'string' ? result.id : '';
      if (!id) {
        throw new Error(
          `Cursor page ${pageCount} contains a result without an id.`,
        );
      }
      returnedCount += 1;
      orderedIdHash.update(id);
      orderedIdHash.update('\n');
      if (seenIds.has(id) && duplicateIds.length < 25) {
        duplicateIds.push(id);
      }
      seenIds.add(id);
    }

    pageCount += 1;
    const nextCursor = cursorPage.nextCursor;
    if (nextCursor === null || nextCursor === undefined) {
      break;
    }
    if (typeof nextCursor !== 'string' || nextCursor.length === 0) {
      throw new Error('Cursor search returned an invalid nextCursor value.');
    }
    if (seenCursors.has(nextCursor)) {
      throw new Error(
        'Cursor traversal returned a repeated continuation token.',
      );
    }
    seenCursors.add(nextCursor);
    cursor = nextCursor;
  }

  return {
    pageCount,
    pageSize,
    totalResults: totalResults ?? 0,
    returnedCount,
    uniqueCount: seenIds.size,
    duplicateCount: returnedCount - seenIds.size,
    duplicateIds,
    orderedIdSha256: orderedIdHash.digest('hex'),
    resultSource,
  };
}

function projectionSnapshot(scaleEvidence) {
  return {
    valid: scaleEvidence?.valid === true,
    activeProfile: scaleEvidence?.activeProfile ?? null,
    projectionId: scaleEvidence?.currentProjectionId ?? null,
    projectionObjectCount:
      asInteger(scaleEvidence?.currentProjectionObjectCount, 0) ?? 0,
    violations: Array.isArray(scaleEvidence?.violations)
      ? scaleEvidence.violations
      : [],
  };
}

export function classifyCursorTraversal({
  profile,
  startProjection,
  endProjection,
  passes,
}) {
  const expectedCount = startProjection.projectionObjectCount;
  const checks = [
    check(
      'scale-evidence-valid',
      startProjection.valid && startProjection.violations.length === 0,
      startProjection.valid
        ? 'Starting scale evidence is valid with no violations.'
        : `Starting scale evidence is invalid: ${startProjection.violations.join('; ') || 'no violation details returned'}.`,
    ),
    check(
      'active-profile',
      startProjection.activeProfile === profile,
      `Active profile is ${startProjection.activeProfile ?? 'missing'}; expected ${profile}.`,
    ),
    check(
      'projection-identity',
      isSha256(startProjection.projectionId) && expectedCount > 0,
      `Starting projection is ${startProjection.projectionId ?? 'missing'} with ${expectedCount.toLocaleString('en-US')} objects.`,
    ),
    check(
      'projection-stable-through-run',
      startProjection.projectionId === endProjection.projectionId &&
        expectedCount === endProjection.projectionObjectCount,
      `Start ${startProjection.projectionId ?? 'missing'} / ${expectedCount.toLocaleString('en-US')} objects; end ${endProjection.projectionId ?? 'missing'} / ${endProjection.projectionObjectCount.toLocaleString('en-US')} objects.`,
    ),
  ];

  for (const [index, pass] of passes.entries()) {
    const label = `pass-${index + 1}`;
    checks.push(
      check(
        `${label}-reported-total`,
        pass.totalResults === expectedCount,
        `Cursor reported ${pass.totalResults.toLocaleString('en-US')} total results; active projection has ${expectedCount.toLocaleString('en-US')} objects.`,
      ),
      check(
        `${label}-complete-count`,
        pass.returnedCount === expectedCount,
        `Traversed ${pass.returnedCount.toLocaleString('en-US')} results across ${pass.pageCount.toLocaleString('en-US')} pages.`,
      ),
      check(
        `${label}-unique-ids`,
        pass.uniqueCount === pass.returnedCount && pass.duplicateCount === 0,
        pass.duplicateCount === 0
          ? `${pass.uniqueCount.toLocaleString('en-US')} unique IDs; no duplicates observed.`
          : `${pass.duplicateCount.toLocaleString('en-US')} duplicate results observed; samples: ${pass.duplicateIds.join(', ') || 'none captured'}.`,
      ),
      check(
        `${label}-repository-source`,
        pass.resultSource === 'REPOSITORY',
        `Cursor resultSource is ${pass.resultSource ?? 'missing'}.`,
      ),
    );
  }

  const referenceHash = passes[0]?.orderedIdSha256 ?? null;
  checks.push(
    check(
      'deterministic-order',
      passes.length >= 2 &&
        isSha256(referenceHash) &&
        passes.every((pass) => pass.orderedIdSha256 === referenceHash),
      passes.length >= 2
        ? `Ordered ID hashes: ${passes.map((pass) => pass.orderedIdSha256).join(', ')}.`
        : 'At least two complete cursor passes are required to prove deterministic order.',
    ),
  );

  return {
    kind: 'civics-cursor-traversal-evidence',
    profile,
    status: checks.every((entry) => entry.status === 'PASS') ? 'PASS' : 'FAIL',
    projectionId: startProjection.projectionId,
    projectionObjectCount: expectedCount,
    checks,
    passes,
  };
}

export async function runCursorTraversalEvidence({
  fetchImpl = globalThis.fetch,
  baseUrl = DEFAULT_BASE_URL,
  profile = DEFAULT_PROFILE,
  pageSize = DEFAULT_PAGE_SIZE,
  passCount = DEFAULT_PASSES,
  maxPages = DEFAULT_MAX_PAGES,
  now = () => new Date(),
} = {}) {
  const root = baseUrl.replace(/\/$/u, '');
  const scaleEvidenceUrl = `${root}/admin/corpus/scale/evidence?profile=${encodeURIComponent(profile)}`;
  const startProjection = projectionSnapshot(
    await fetchJson(fetchImpl, scaleEvidenceUrl),
  );
  const passes = [];

  for (let index = 0; index < passCount; index += 1) {
    passes.push(
      await traverseCursor({
        fetchImpl,
        baseUrl: root,
        pageSize,
        maxPages,
      }),
    );
  }

  const endProjection = projectionSnapshot(
    await fetchJson(fetchImpl, scaleEvidenceUrl),
  );
  return {
    ...classifyCursorTraversal({
      profile,
      startProjection,
      endProjection,
      passes,
    }),
    capturedAt: now().toISOString(),
    startProjection,
    endProjection,
  };
}

export function renderCursorTraversalMarkdown(result) {
  const rows = result.checks
    .map((entry) => `| ${entry.id} | ${entry.status} | ${entry.detail} |`)
    .join('\n');
  const passes = result.passes
    .map(
      (pass, index) =>
        `- Pass ${index + 1}: ${pass.returnedCount.toLocaleString('en-US')} results, ${pass.pageCount.toLocaleString('en-US')} pages, ordered ID SHA-256 \`${pass.orderedIdSha256}\``,
    )
    .join('\n');

  return `# Cursor Traversal Evidence — ${result.profile}\n\nCaptured: ${result.capturedAt}\n\n- Status: **${result.status}**\n- Projection: \`${result.projectionId ?? 'missing'}\`\n- Projection objects: **${result.projectionObjectCount.toLocaleString('en-US')}**\n\n${passes}\n\n| Check | Status | Detail |\n| --- | --- | --- |\n${rows}\n\nThis command is read-only. It traverses the active search projection through opaque cursors and is intentionally excluded from ordinary pull-request CI.\n`;
}

function requirePositiveInteger(value, name) {
  const parsed = asInteger(value);
  if (parsed === null || parsed < 1) {
    throw new Error(`${name} must be a positive integer.`);
  }
  return parsed;
}

export function parseArguments(argv) {
  const args = argv[0] === '--' ? argv.slice(1) : argv;
  const options = {
    baseUrl: DEFAULT_BASE_URL,
    profile: DEFAULT_PROFILE,
    pageSize: DEFAULT_PAGE_SIZE,
    passCount: DEFAULT_PASSES,
    maxPages: DEFAULT_MAX_PAGES,
    output: DEFAULT_OUTPUT,
  };

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    const value = args[index + 1];
    switch (argument) {
      case '--base-url':
        options.baseUrl = value;
        index += 1;
        break;
      case '--profile':
        options.profile = value;
        index += 1;
        break;
      case '--page-size':
        options.pageSize = requirePositiveInteger(value, 'page-size');
        index += 1;
        break;
      case '--passes':
        options.passCount = requirePositiveInteger(value, 'passes');
        index += 1;
        break;
      case '--max-pages':
        options.maxPages = requirePositiveInteger(value, 'max-pages');
        index += 1;
        break;
      case '--output':
        options.output = value;
        index += 1;
        break;
      default:
        throw new Error(`Unknown cursor traversal argument: ${argument}`);
    }
  }

  return options;
}

export async function main(argv = process.argv.slice(2)) {
  const options = parseArguments(argv);
  const result = await runCursorTraversalEvidence(options);
  const outputPath = resolve(options.output);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  const markdownPath = outputPath.replace(/\.json$/iu, '.md');
  const markdown = renderCursorTraversalMarkdown(result);
  await writeFile(markdownPath, markdown, 'utf8');
  console.log(`Cursor traversal JSON written to ${outputPath}`);
  console.log(`Cursor traversal Markdown written to ${markdownPath}`);
  console.log(markdown);

  if (result.status !== 'PASS') {
    process.exitCode = 2;
  }
}

if (
  process.argv[1] &&
  import.meta.url ===
    new URL(`file://${resolve(process.argv[1]).replace(/\\/gu, '/')}`).href
) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
