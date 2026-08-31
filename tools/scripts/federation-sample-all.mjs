import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const FEDERATION_SAMPLE_SOURCES = [
  'DATA_GOV',
  'DOE_OSTI',
  'NASA_CMR',
  'PUBMED',
  'OPENALEX',
];

const DEFAULT_BASE_URL = 'http://localhost:8080/api';
const DEFAULT_PAGE_SIZE = 25;
const DEFAULT_OUTPUT =
  'browser-evidence-artifacts/federation-samples/all-source-sample.json';

export function parseArguments(argv = process.argv.slice(2)) {
  const args = argv.filter((argument) => argument !== '--');
  const options = {
    baseUrl: DEFAULT_BASE_URL,
    pageSize: DEFAULT_PAGE_SIZE,
    outputPath: DEFAULT_OUTPUT,
  };
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === '--base-url') {
      options.baseUrl = requiredValue(args, ++index, argument);
    } else if (argument === '--page-size') {
      options.pageSize = boundedInteger(
        requiredValue(args, ++index, argument),
        argument,
        1,
        500,
      );
    } else if (argument === '--output') {
      options.outputPath = requiredValue(args, ++index, argument);
    } else {
      throw new Error(`Unsupported federation sample argument: ${argument}`);
    }
  }
  options.baseUrl = options.baseUrl.replace(/\/$/, '');
  return options;
}

export async function sampleAllFederatedSources({
  fetchImpl = fetch,
  baseUrl = DEFAULT_BASE_URL,
  pageSize = DEFAULT_PAGE_SIZE,
  now = () => new Date(),
} = {}) {
  const results = [];
  for (const sourceSystem of FEDERATION_SAMPLE_SOURCES) {
    const before = await readStatus(fetchImpl, baseUrl, sourceSystem);
    if (before.retainedRecordCount > 0) {
      results.push({
        sourceSystem,
        status: 'EXISTING',
        beforeRetainedRecordCount: before.retainedRecordCount,
        afterRetainedRecordCount: before.retainedRecordCount,
        acceptedThisSample: 0,
        detail:
          'Retained metadata already exists; sampler did not advance this source checkpoint.',
      });
      continue;
    }

    try {
      const run = await requestSample(
        fetchImpl,
        baseUrl,
        sourceSystem,
        pageSize,
      );
      const after = await readStatus(fetchImpl, baseUrl, sourceSystem);
      results.push({
        sourceSystem,
        status: 'SAMPLED',
        beforeRetainedRecordCount: before.retainedRecordCount,
        afterRetainedRecordCount: after.retainedRecordCount,
        acceptedThisSample: Math.max(
          0,
          after.retainedRecordCount - before.retainedRecordCount,
        ),
        runId: run.runId ?? null,
        runStatus: run.status ?? null,
        adapterVersion: run.adapterVersion ?? null,
        detail: `One bounded page requested at pageSize=${pageSize}.`,
      });
    } catch (error) {
      results.push({
        sourceSystem,
        status: 'FAILED',
        beforeRetainedRecordCount: before.retainedRecordCount,
        afterRetainedRecordCount: before.retainedRecordCount,
        acceptedThisSample: 0,
        detail: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return {
    capturedAt: now().toISOString(),
    pageSize,
    sources: results,
    successful: results.every((result) => result.status !== 'FAILED'),
    methodology:
      'Existing retained sources are observed but not advanced. Empty sources receive one bounded harvest page. No search projection is activated by this sampler.',
  };
}

export function renderMarkdown(report) {
  const lines = [
    '# Federation Source Sample Report',
    '',
    `Captured: ${report.capturedAt}`,
    '',
    `Overall: **${report.successful ? 'PASS' : 'PARTIAL'}**`,
    '',
    '| Source | Status | Retained before | Retained after | Accepted now | Adapter/run |',
    '| --- | --- | ---: | ---: | ---: | --- |',
  ];
  for (const result of report.sources) {
    const evidence = [result.adapterVersion, result.runId]
      .filter(Boolean)
      .join(' / ');
    lines.push(
      `| ${result.sourceSystem} | ${result.status} | ${result.beforeRetainedRecordCount} | ${result.afterRetainedRecordCount} | ${result.acceptedThisSample} | ${evidence || '—'} |`,
    );
  }
  lines.push(
    '',
    '## Methodology',
    '',
    report.methodology,
    '',
    'Sampling is metadata-only. Publisher binaries are not mirrored. A source failure remains visible in this report and does not prevent the sampler from attempting the remaining authorities.',
    '',
    '## Projection boundary',
    '',
    'This command does **not** activate a mixed-source search projection. That separation preserves the current proven benchmark profile until a named mixed-source research profile and composite evidence model are deliberately activated.',
  );
  return `${lines.join('\n')}\n`;
}

async function readStatus(fetchImpl, baseUrl, sourceSystem) {
  const response = await fetchImpl(
    `${baseUrl}/admin/federation/harvest/status?sourceSystem=${encodeURIComponent(sourceSystem)}`,
  );
  if (!response.ok) {
    throw new Error(
      `Status check for ${sourceSystem} failed with HTTP ${response.status}: ${await safeBody(response)}`,
    );
  }
  return response.json();
}

async function requestSample(fetchImpl, baseUrl, sourceSystem, pageSize) {
  const response = await fetchImpl(`${baseUrl}/admin/federation/harvest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sourceSystem, pageSize, maxPages: 1 }),
  });
  if (!response.ok) {
    throw new Error(
      `Sample harvest for ${sourceSystem} failed with HTTP ${response.status}: ${await safeBody(response)}`,
    );
  }
  return response.json();
}

async function safeBody(response) {
  try {
    return await response.text();
  } catch {
    return '<response body unavailable>';
  }
}

function requiredValue(args, index, argument) {
  const value = args[index];
  if (value == null || value.startsWith('--')) {
    throw new Error(`${argument} requires a value.`);
  }
  return value;
}

function boundedInteger(value, argument, min, max) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new Error(
      `${argument} must be an integer between ${min} and ${max}.`,
    );
  }
  return parsed;
}

async function main() {
  const options = parseArguments();
  const report = await sampleAllFederatedSources({
    baseUrl: options.baseUrl,
    pageSize: options.pageSize,
  });
  const outputPath = resolve(options.outputPath);
  const markdownPath = outputPath.replace(/\.json$/i, '.md');
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  await writeFile(markdownPath, renderMarkdown(report), 'utf8');
  console.log(`Federation sample JSON written to ${outputPath}`);
  console.log(`Federation sample Markdown written to ${markdownPath}`);
  console.log(renderMarkdown(report));
  if (!report.successful) {
    process.exitCode = 1;
  }
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
