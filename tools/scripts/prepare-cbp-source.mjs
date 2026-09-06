import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SOURCE_YEAR = 2023;
const SOURCE_ARCHIVE_URL =
  'https://www2.census.gov/programs-surveys/cbp/datasets/2023/cbp23co.zip';
const REQUIRED_HEADERS = [
  'FIPSTATE',
  'FIPSCTY',
  'NAICS',
  'EMP_NF',
  'EMP',
  'QP1_NF',
  'QP1',
  'AP_NF',
  'AP',
  'EST',
];
const NORMALIZED_HEADERS = [
  'GEOID',
  'INDUSTRY_CODE',
  'SOURCE_NAICS',
  'ESTABLISHMENTS',
  'EMPLOYMENT',
  'EMPLOYMENT_NOISE_FLAG',
  'FIRST_QUARTER_PAYROLL_THOUSANDS',
  'FIRST_QUARTER_PAYROLL_NOISE_FLAG',
  'ANNUAL_PAYROLL_THOUSANDS',
  'ANNUAL_PAYROLL_NOISE_FLAG',
];
const VALID_NOISE_FLAGS = new Set(['', 'G', 'H', 'J']);

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const defaultOutputDirectory = join(
  repoRoot,
  'apps',
  'repository-api',
  'src',
  'main',
  'resources',
  'maps',
  'county-business-patterns',
);

export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];

    if (quoted) {
      if (character === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        field += character;
      }
      continue;
    }

    if (character === '"') {
      quoted = true;
      continue;
    }

    if (character === ',') {
      row.push(field);
      field = '';
      continue;
    }

    if (character === '\n') {
      row.push(field.replace(/\r$/, ''));
      rows.push(row);
      row = [];
      field = '';
      continue;
    }

    field += character;
  }

  if (quoted) {
    throw new Error('CBP source contains an unterminated quoted CSV field.');
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field.replace(/\r$/, ''));
    rows.push(row);
  }

  return rows;
}

export function prepareCbpDataset(sourceText) {
  const rows = parseCsv(sourceText.replace(/^\uFEFF/, ''));
  if (rows.length < 2) {
    throw new Error(
      'CBP source must contain a header and at least one data row.',
    );
  }

  const headers = rows[0].map((header) => header.trim().toUpperCase());
  const headerIndexes = new Map();

  for (const [index, header] of headers.entries()) {
    if (!header) {
      throw new Error('CBP source contains a blank header.');
    }
    if (headerIndexes.has(header)) {
      throw new Error(`CBP source contains duplicate header ${header}.`);
    }
    headerIndexes.set(header, index);
  }

  for (const required of REQUIRED_HEADERS) {
    if (!headerIndexes.has(required)) {
      throw new Error(`CBP source is missing required header ${required}.`);
    }
  }

  const retained = [];
  const seen = new Set();
  let excludedStatewideRows = 0;

  for (let rowIndex = 1; rowIndex < rows.length; rowIndex += 1) {
    const sourceRow = rows[rowIndex];
    if (sourceRow.every((value) => value.trim() === '')) {
      continue;
    }

    const field = (name) => sourceRow[headerIndexes.get(name)]?.trim() ?? '';
    const stateFips = requirePattern(
      field('FIPSTATE'),
      /^\d{2}$/,
      'FIPSTATE',
      rowIndex,
    );
    const countyFips = requirePattern(
      field('FIPSCTY'),
      /^\d{3}$/,
      'FIPSCTY',
      rowIndex,
    );
    const sourceNaics = field('NAICS');

    if (!isRetainedNaics(sourceNaics)) {
      continue;
    }

    // The downloadable CBP county file includes XX999 aggregate records that are not county
    // polygons. They are valid CBP records, but retaining them in a county map resource would
    // create synthetic five-digit "county" GEOIDs that cannot join to TIGERweb. Exclude them at
    // the source boundary and record the count in provenance instead of weakening geometry checks.
    if (countyFips === '999') {
      excludedStatewideRows += 1;
      continue;
    }

    const industryCode =
      sourceNaics === '------' ? 'TOTAL' : sourceNaics.slice(0, 2);
    const geoid = `${stateFips}${countyFips}`;
    const key = `${geoid}:${industryCode}`;

    if (seen.has(key)) {
      throw new Error(
        `CBP source contains duplicate retained county/industry row ${key}.`,
      );
    }
    seen.add(key);

    const employmentNoiseFlag = requireNoiseFlag(
      field('EMP_NF'),
      'EMP_NF',
      rowIndex,
    );
    const firstQuarterPayrollNoiseFlag = requireNoiseFlag(
      field('QP1_NF'),
      'QP1_NF',
      rowIndex,
    );
    const annualPayrollNoiseFlag = requireNoiseFlag(
      field('AP_NF'),
      'AP_NF',
      rowIndex,
    );

    retained.push({
      geoid,
      industryCode,
      sourceNaics,
      establishments: requireNonnegativeInteger(field('EST'), 'EST', rowIndex),
      employment: requireNonnegativeInteger(field('EMP'), 'EMP', rowIndex),
      employmentNoiseFlag,
      firstQuarterPayrollThousands: requireNonnegativeInteger(
        field('QP1'),
        'QP1',
        rowIndex,
      ),
      firstQuarterPayrollNoiseFlag,
      annualPayrollThousands: requireNonnegativeInteger(
        field('AP'),
        'AP',
        rowIndex,
      ),
      annualPayrollNoiseFlag,
    });
  }

  if (retained.length === 0) {
    throw new Error(
      'CBP source contained no county all-sector or two-digit NAICS rows.',
    );
  }

  retained.sort(
    (left, right) =>
      left.geoid.localeCompare(right.geoid) ||
      industrySortKey(left.industryCode).localeCompare(
        industrySortKey(right.industryCode),
      ),
  );

  return { rows: retained, excludedStatewideRows };
}

export function prepareCbpRows(sourceText) {
  return prepareCbpDataset(sourceText).rows;
}

export function serializeCbpRows(rows) {
  const lines = [NORMALIZED_HEADERS.join(',')];

  for (const row of rows) {
    lines.push(
      [
        row.geoid,
        row.industryCode,
        row.sourceNaics,
        row.establishments,
        row.employment,
        row.employmentNoiseFlag,
        row.firstQuarterPayrollThousands,
        row.firstQuarterPayrollNoiseFlag,
        row.annualPayrollThousands,
        row.annualPayrollNoiseFlag,
      ]
        .map(csvValue)
        .join(','),
    );
  }

  return `${lines.join('\n')}\n`;
}

export function buildMetadata({
  sourceBytes,
  normalizedText,
  retainedRows,
  excludedStatewideRows = 0,
  capturedAt,
  sourceFileName,
}) {
  requireCapturedAt(capturedAt);

  if (!Number.isSafeInteger(excludedStatewideRows) || excludedStatewideRows < 0) {
    throw new Error('excludedStatewideRows must be a nonnegative integer.');
  }

  const countyGeoids = [
    ...new Set(retainedRows.map((row) => row.geoid)),
  ].sort();
  const industryCodes = [
    ...new Set(retainedRows.map((row) => row.industryCode)),
  ].sort((left, right) =>
    industrySortKey(left).localeCompare(industrySortKey(right)),
  );

  return {
    source: 'U.S. Census Bureau County Business Patterns',
    sourceArchiveUrl: SOURCE_ARCHIVE_URL,
    sourceFileName,
    referenceYear: SOURCE_YEAR,
    sourceEncoding: 'UTF-8/ASCII-compatible CSV',
    capturedAt,
    sourceFileSha256: sha256(sourceBytes),
    normalizedSha256: sha256(Buffer.from(normalizedText, 'utf8')),
    retainedRows: retainedRows.length,
    retainedCounties: countyGeoids.length,
    excludedStatewideRows,
    countyEligibilityRule: 'FIPSCTY != 999',
    supportedIndustryCodes: industryCodes,
    retainedSourceNaicsRule: '------ or NN----',
    noiseFlags: {
      G: '0 to less than 2% noise',
      H: '2 to less than 5% noise',
      J: 'at least 5% noise',
    },
    missingRowSemantics:
      'A missing county/industry row is unavailable in the published source and must not be interpreted as zero.',
  };
}

function isRetainedNaics(value) {
  return value === '------' || /^\d{2}----$/.test(value);
}

function requirePattern(value, pattern, fieldName, rowIndex) {
  if (!pattern.test(value)) {
    throw new Error(
      `CBP row ${rowIndex + 1} has invalid ${fieldName} value ${JSON.stringify(value)}.`,
    );
  }
  return value;
}

function requireNoiseFlag(value, fieldName, rowIndex) {
  const normalized = value.toUpperCase();
  if (!VALID_NOISE_FLAGS.has(normalized)) {
    throw new Error(
      `CBP row ${rowIndex + 1} has invalid ${fieldName} value ${JSON.stringify(value)}.`,
    );
  }
  return normalized;
}

function requireNonnegativeInteger(value, fieldName, rowIndex) {
  if (!/^\d+$/.test(value)) {
    throw new Error(
      `CBP row ${rowIndex + 1} has nonnumeric ${fieldName} value ${JSON.stringify(value)}.`,
    );
  }

  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error(
      `CBP row ${rowIndex + 1} has invalid ${fieldName} integer ${JSON.stringify(value)}.`,
    );
  }
  return parsed;
}

function requireCapturedAt(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error('--captured-at must use YYYY-MM-DD.');
  }
}

function industrySortKey(value) {
  return value === 'TOTAL' ? '00' : value;
}

function csvValue(value) {
  const text = String(value ?? '');
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function argumentValue(args, name) {
  const index = args.indexOf(name);
  if (index === -1 || !args[index + 1]) {
    return null;
  }
  return args[index + 1];
}

function runCli() {
  const args = process.argv.slice(2);
  const sourceArgument = argumentValue(args, '--source');
  const capturedAt = argumentValue(args, '--captured-at');
  const outputDirectory = resolve(
    argumentValue(args, '--output') ?? defaultOutputDirectory,
  );

  if (!sourceArgument) {
    throw new Error(
      'Usage: node tools/scripts/prepare-cbp-source.mjs --source <extracted-cbp23co.csv> --captured-at YYYY-MM-DD [--output <directory>]',
    );
  }
  requireCapturedAt(capturedAt ?? '');

  const sourcePath = resolve(sourceArgument);
  const sourceBytes = readFileSync(sourcePath);
  const sourceText = sourceBytes.toString('utf8');
  const dataset = prepareCbpDataset(sourceText);
  const normalizedText = serializeCbpRows(dataset.rows);
  const metadata = buildMetadata({
    sourceBytes,
    normalizedText,
    retainedRows: dataset.rows,
    excludedStatewideRows: dataset.excludedStatewideRows,
    capturedAt,
    sourceFileName: sourcePath.split(/[\\/]/).at(-1),
  });

  mkdirSync(outputDirectory, { recursive: true });
  const csvPath = join(outputDirectory, 'cbp-2023-county.csv');
  const metadataPath = join(outputDirectory, 'source.json');

  writeFileSync(csvPath, normalizedText);
  writeFileSync(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`);

  console.log(
    `Retained ${metadata.retainedRows} CBP rows across ${metadata.retainedCounties} counties and ${metadata.supportedIndustryCodes.length} industry codes; excluded ${metadata.excludedStatewideRows} non-county aggregate rows.`,
  );
  console.log(`Written ${csvPath}`);
  console.log(`Written ${metadataPath}`);
}

const invokedPath = process.argv[1]
  ? pathToFileURL(resolve(process.argv[1])).href
  : null;
if (invokedPath === import.meta.url) {
  try {
    runCli();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
