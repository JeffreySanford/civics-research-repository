import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  buildDataGovSpatialSearchUrl,
  buildRetainedIdentifiersSql,
  loadScaleCertification,
  parsePsqlIdentifiers,
  requirePersonalDataGovApiKey,
  runPsqlIdentifiers,
} from './data-gov-spatial-availability.mjs';
import { analyzeGeoJsonGeometry } from './data-gov-spatial-geometry-census.mjs';

const DEFAULT_OUTPUT_DIR = 'browser-evidence-artifacts/spatial-semantics';
const DEFAULT_SEARCH_URL = 'https://api.gsa.gov/technology/datagov/v4/search';
const DEFAULT_PAGE_SIZE = 1_000;
const DEFAULT_MAX_PAGES = 2_000;
const DEFAULT_PROGRESS_EVERY_PAGES = 100;
const DEFAULT_SAMPLE_LIMIT = 24;
const MAX_PAGE_SIZE = 1_000;
const BOUNDS_TOLERANCE = 1e-5;

const FOUR_NUMBER_ORDERINGS = [
  ['west-south-east-north', ['west', 'south', 'east', 'north']],
  ['east-south-west-north', ['east', 'south', 'west', 'north']],
  ['west-north-east-south', ['west', 'north', 'east', 'south']],
  ['east-north-west-south', ['east', 'north', 'west', 'south']],
  ['south-west-north-east', ['south', 'west', 'north', 'east']],
  ['south-east-north-west', ['south', 'east', 'north', 'west']],
  ['north-west-south-east', ['north', 'west', 'south', 'east']],
  ['north-east-south-west', ['north', 'east', 'south', 'west']],
];

export function classifyCentroid(value) {
  if (value === null || value === undefined) return null;

  if (Array.isArray(value)) {
    return centroidResult('coordinate-array', pointFromLonLat(value));
  }

  if (isObject(value)) {
    const type = textValue(value.type);
    if (type === 'Point' && Array.isArray(value.coordinates)) {
      return centroidResult(
        'geojson-point-object',
        pointFromLonLat(value.coordinates),
      );
    }
    if (Array.isArray(value.coordinates)) {
      return centroidResult(
        'coordinates-object',
        pointFromLonLat(value.coordinates),
      );
    }
    if (finiteNumber(value.lat) !== null && finiteNumber(value.lon) !== null) {
      return centroidResult('lat-lon-object', {
        lon: Number(value.lon),
        lat: Number(value.lat),
      });
    }
    if (finiteNumber(value.lat) !== null && finiteNumber(value.lng) !== null) {
      return centroidResult('lat-lng-object', {
        lon: Number(value.lng),
        lat: Number(value.lat),
      });
    }
    if (
      finiteNumber(value.latitude) !== null &&
      finiteNumber(value.longitude) !== null
    ) {
      return centroidResult('latitude-longitude-object', {
        lon: Number(value.longitude),
        lat: Number(value.latitude),
      });
    }
    return centroidResult('object-other', null, {
      keys: Object.keys(value).sort().slice(0, 12),
    });
  }

  if (typeof value === 'string') {
    const text = value.trim();
    if (!text) return null;

    if (text.startsWith('{') || text.startsWith('[')) {
      try {
        const nested = classifyCentroid(JSON.parse(text));
        return nested
          ? { ...nested, family: `json-string:${nested.family}` }
          : centroidResult('json-string:null', null);
      } catch {
        return centroidResult('json-string-invalid', null);
      }
    }

    const wkt = text.match(
      /^POINT\s*\(\s*([-+]?\d+(?:\.\d+)?(?:[eE][-+]?\d+)?)\s+([-+]?\d+(?:\.\d+)?(?:[eE][-+]?\d+)?)\s*\)$/i,
    );
    if (wkt) {
      return centroidResult('wkt-point-string', {
        lon: Number(wkt[1]),
        lat: Number(wkt[2]),
      });
    }

    const parts = text.split(',').map((part) => part.trim());
    if (
      parts.length === 2 &&
      parts.every((part) => finiteNumber(part) !== null)
    ) {
      return centroidResult('comma-two-numeric-ambiguous', null, {
        numericValues: parts.map(Number),
      });
    }
    return centroidResult('string-other', null);
  }

  return centroidResult(`${typeof value}-other`, null);
}

export function classifyDcatSpatialSemantics(value, shapeBounds = null) {
  const text = textValue(value);
  if (!text) return null;

  if (text.startsWith('{') || text.startsWith('[')) {
    try {
      const parsed = JSON.parse(text);
      return {
        family: Array.isArray(parsed) ? 'json-array' : 'json-object',
        fourNumbers: null,
        inferredOrdering: null,
        orderingMatches: [],
      };
    } catch {
      return {
        family: 'json-like-invalid',
        fourNumbers: null,
        inferredOrdering: null,
        orderingMatches: [],
      };
    }
  }

  const parts = text.split(',').map((part) => part.trim());
  const numbers = parts.map(Number);
  if (parts.length === 4 && numbers.every(Number.isFinite)) {
    const inference = inferFourNumberOrdering(numbers, shapeBounds);
    return {
      family: 'comma-four-numeric',
      fourNumbers: numbers,
      inferredOrdering: inference.inferredOrdering,
      orderingMatches: inference.matches,
    };
  }

  if (parts.length > 1 && numbers.every(Number.isFinite)) {
    return {
      family: 'comma-numeric-other',
      fourNumbers: null,
      inferredOrdering: null,
      orderingMatches: [],
    };
  }

  return {
    family: 'free-text',
    fourNumbers: null,
    inferredOrdering: null,
    orderingMatches: [],
  };
}

export function inferFourNumberOrdering(
  values,
  shapeBounds,
  tolerance = BOUNDS_TOLERANCE,
) {
  if (
    !Array.isArray(values) ||
    values.length !== 4 ||
    !values.every(Number.isFinite)
  ) {
    return { inferredOrdering: null, matches: [] };
  }
  if (!validBounds(shapeBounds)) {
    return { inferredOrdering: null, matches: [] };
  }

  const matches = [];
  for (const [name, fields] of FOUR_NUMBER_ORDERINGS) {
    const candidate = {};
    for (let index = 0; index < fields.length; index += 1) {
      candidate[fields[index]] = values[index];
    }
    if (
      approximately(candidate.west, shapeBounds.minLon, tolerance) &&
      approximately(candidate.south, shapeBounds.minLat, tolerance) &&
      approximately(candidate.east, shapeBounds.maxLon, tolerance) &&
      approximately(candidate.north, shapeBounds.maxLat, tolerance)
    ) {
      matches.push(name);
    }
  }

  return {
    inferredOrdering: matches.length === 1 ? matches[0] : null,
    matches,
  };
}

export function pointWithinBounds(point, bounds, tolerance = BOUNDS_TOLERANCE) {
  if (!validPoint(point) || !validBounds(bounds)) return false;
  return (
    point.lon >= bounds.minLon - tolerance &&
    point.lon <= bounds.maxLon + tolerance &&
    point.lat >= bounds.minLat - tolerance &&
    point.lat <= bounds.maxLat + tolerance
  );
}

export function pointMatchesBoundsCenter(
  point,
  bounds,
  tolerance = BOUNDS_TOLERANCE,
) {
  if (!validPoint(point) || !validBounds(bounds)) return false;
  return (
    approximately(point.lon, (bounds.minLon + bounds.maxLon) / 2, tolerance) &&
    approximately(point.lat, (bounds.minLat + bounds.maxLat) / 2, tolerance)
  );
}

export async function probeDataGovSpatialSemantics({
  retainedIdentifiers,
  apiKey,
  fetchImpl = globalThis.fetch,
  searchUrl = DEFAULT_SEARCH_URL,
  pageSize = DEFAULT_PAGE_SIZE,
  maxPages = DEFAULT_MAX_PAGES,
  progressEveryPages = DEFAULT_PROGRESS_EVERY_PAGES,
  sampleLimit = DEFAULT_SAMPLE_LIMIT,
  onProgress = null,
}) {
  if (!(retainedIdentifiers instanceof Set)) {
    throw new Error('retainedIdentifiers must be a Set.');
  }
  requireNonDemoApiKey(apiKey);
  if (typeof fetchImpl !== 'function') {
    throw new Error('fetchImpl must be a function.');
  }

  const safePageSize = positiveInteger(pageSize, 'pageSize', MAX_PAGE_SIZE);
  const safeMaxPages = positiveInteger(maxPages, 'maxPages', DEFAULT_MAX_PAGES);
  const safeProgressEveryPages = positiveInteger(
    progressEveryPages,
    'progressEveryPages',
    DEFAULT_MAX_PAGES,
  );
  const safeSampleLimit = nonNegativeInteger(sampleLimit, 'sampleLimit');

  const seenSourceIdentifiers = new Set();
  const duplicateSourceIdentifiers = new Set();
  const observations = new Map();
  let sourceSpatialRowCount = 0;
  let duplicateSourceRowCount = 0;
  let pagesFetched = 0;
  let cursor = null;
  let previous = progressSnapshot();

  while (true) {
    if (pagesFetched >= safeMaxPages) {
      throw new Error(
        `Data.gov spatial semantics probe reached maxPages=${safeMaxPages} before completion.`,
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
        `Data.gov spatial semantics probe hit HTTP 429${retryAfter ? `; retry after ${retryAfter}` : ''}.`,
      );
    }
    if (!response.ok) {
      throw new Error(
        `Data.gov spatial semantics request failed with HTTP ${response.status}: ${url}`,
      );
    }

    const page = await response.json();
    const results = Array.isArray(page?.results) ? page.results : null;
    if (!results) {
      throw new Error('Data.gov spatial search response is missing results.');
    }
    pagesFetched += 1;

    for (const dataset of results) {
      const identifier = sourceIdentifier(dataset);
      if (!identifier) {
        throw new Error(
          'Data.gov spatial search returned a record without a stable identifier.',
        );
      }
      sourceSpatialRowCount += 1;
      if (seenSourceIdentifiers.has(identifier)) {
        duplicateSourceRowCount += 1;
        duplicateSourceIdentifiers.add(identifier);
      } else {
        seenSourceIdentifiers.add(identifier);
      }
      if (!retainedIdentifiers.has(identifier)) continue;

      const incoming = semanticsObservation(dataset);
      const current = observations.get(identifier);
      observations.set(
        identifier,
        current ? mergeObservation(current, incoming) : incoming,
      );
    }

    const nextCursor = textValue(page?.after);
    if (nextCursor && results.length === 0) {
      throw new Error(
        'Data.gov spatial search returned an empty page with a continuation cursor.',
      );
    }
    const done = !nextCursor;

    if (onProgress && (pagesFetched % safeProgressEveryPages === 0 || done)) {
      const current = progressSnapshot({
        pagesFetched,
        sourceSpatialRowCount,
        sourceSpatialRecordCount: seenSourceIdentifiers.size,
        duplicateSourceRowCount,
        retainedSpatialRecordCount: observations.size,
        centroidPresentCount: countSignal(observations, 'centroid'),
        dcatPresentCount: countSignal(observations, 'dcat'),
      });
      onProgress({
        ...current,
        window: differenceSnapshot(current, previous),
        done,
      });
      previous = current;
    }

    if (done) break;
    cursor = nextCursor;
  }

  return summarizeSpatialSemantics({
    retainedIdentifiers,
    observations,
    sourceSpatialRowCount,
    sourceSpatialRecordCount: seenSourceIdentifiers.size,
    duplicateSourceRowCount,
    duplicateSourceIdentifierCount: duplicateSourceIdentifiers.size,
    pagesFetched,
    sampleLimit: safeSampleLimit,
  });
}

export function summarizeSpatialSemantics({
  retainedIdentifiers,
  observations,
  sourceSpatialRowCount,
  sourceSpatialRecordCount,
  duplicateSourceRowCount,
  duplicateSourceIdentifierCount,
  pagesFetched,
  sampleLimit = DEFAULT_SAMPLE_LIMIT,
}) {
  const centroid = {
    presentCount: 0,
    families: {},
    normalizedPointCount: 0,
    validNormalizedPointCount: 0,
    outOfRangeNormalizedPointCount: 0,
    comparedToShapeBoundsCount: 0,
    withinShapeBoundsCount: 0,
    matchesShapeBoundsCenterCount: 0,
    variantIdentifierCount: 0,
  };
  const dcat = {
    presentCount: 0,
    families: {},
    fourNumericCount: 0,
    fourNumericComparedToShapeCount: 0,
    uniqueOrderingMatchCount: 0,
    ambiguousOrderingMatchCount: 0,
    noOrderingMatchCount: 0,
    inferredOrderings: {},
    variantIdentifierCount: 0,
  };
  const samples = [];

  for (const [identifier, observation] of observations) {
    if (observation.centroid) {
      centroid.presentCount += 1;
      increment(centroid.families, observation.centroid.family);
      if (observation.centroid.point) {
        centroid.normalizedPointCount += 1;
        if (observation.centroid.validCoordinates) {
          centroid.validNormalizedPointCount += 1;
        } else {
          centroid.outOfRangeNormalizedPointCount += 1;
        }
        if (observation.shapeBounds && observation.centroid.validCoordinates) {
          centroid.comparedToShapeBoundsCount += 1;
          if (
            pointWithinBounds(
              observation.centroid.point,
              observation.shapeBounds,
            )
          ) {
            centroid.withinShapeBoundsCount += 1;
          }
          if (
            pointMatchesBoundsCenter(
              observation.centroid.point,
              observation.shapeBounds,
            )
          ) {
            centroid.matchesShapeBoundsCenterCount += 1;
          }
        }
      }
    }
    if (observation.centroidVariant) centroid.variantIdentifierCount += 1;

    if (observation.dcat) {
      dcat.presentCount += 1;
      increment(dcat.families, observation.dcat.family);
      if (observation.dcat.family === 'comma-four-numeric') {
        dcat.fourNumericCount += 1;
        if (observation.shapeBounds) {
          dcat.fourNumericComparedToShapeCount += 1;
          const matches = observation.dcat.orderingMatches;
          if (matches.length === 1) {
            dcat.uniqueOrderingMatchCount += 1;
            increment(dcat.inferredOrderings, matches[0]);
          } else if (matches.length > 1) {
            dcat.ambiguousOrderingMatchCount += 1;
          } else {
            dcat.noOrderingMatchCount += 1;
          }
        }
      }
    }
    if (observation.dcatVariant) dcat.variantIdentifierCount += 1;

    if (samples.length < sampleLimit && interestingObservation(observation)) {
      samples.push({
        identifier,
        title: observation.title,
        centroidFamily: observation.centroid?.family ?? null,
        centroidPoint: observation.centroid?.point ?? null,
        centroidValidCoordinates:
          observation.centroid?.validCoordinates ?? null,
        centroidWithinShapeBounds:
          observation.centroid?.point && observation.shapeBounds
            ? pointWithinBounds(
                observation.centroid.point,
                observation.shapeBounds,
              )
            : null,
        dcatFamily: observation.dcat?.family ?? null,
        dcatFourNumbers: observation.dcat?.fourNumbers ?? null,
        inferredOrdering: observation.dcat?.inferredOrdering ?? null,
        orderingMatches: observation.dcat?.orderingMatches ?? [],
        shapeBounds: observation.shapeBounds,
      });
    }
  }

  return {
    kind: 'data-gov-spatial-source-semantics',
    schemaVersion: 1,
    method: 'data-gov-v4-source-semantics-intersection',
    retainedDataGovIdentifierCount: retainedIdentifiers.size,
    retainedSpatialRecordCount: observations.size,
    sourceSpatialRowCount,
    sourceSpatialRecordCount,
    duplicateSourceRowCount,
    duplicateSourceIdentifierCount,
    pagesFetched,
    centroid,
    dcatSpatial: dcat,
    samples,
  };
}

export function parseArgs(argv = []) {
  const args = {
    expectedCount: null,
    outputDir: DEFAULT_OUTPUT_DIR,
    scaleEvidencePath: null,
    searchUrl: DEFAULT_SEARCH_URL,
    pageSize: DEFAULT_PAGE_SIZE,
    maxPages: DEFAULT_MAX_PAGES,
    progressEveryPages: DEFAULT_PROGRESS_EVERY_PAGES,
    sampleLimit: DEFAULT_SAMPLE_LIMIT,
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
        MAX_PAGE_SIZE,
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
    if (argument === '--progress-every') {
      args.progressEveryPages = positiveInteger(
        argv[index + 1],
        '--progress-every',
        DEFAULT_MAX_PAGES,
      );
      index += 1;
      continue;
    }
    if (argument === '--sample-limit') {
      args.sampleLimit = nonNegativeInteger(argv[index + 1], '--sample-limit');
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${argument}`);
  }
  return args;
}

export async function run(argv = process.argv.slice(2), env = process.env) {
  const args = parseArgs(argv);
  const scaleCertification = args.scaleEvidencePath
    ? await loadScaleCertification(args.scaleEvidencePath)
    : null;

  console.log('[semantics] Loading retained Data.gov identifiers from C2...');
  const loadStartedAt = Date.now();
  const retainedIdentifiers = parsePsqlIdentifiers(
    runPsqlIdentifiers(buildRetainedIdentifiersSql(), env),
  );
  console.log(
    `[semantics] Loaded ${retainedIdentifiers.size.toLocaleString()} retained identifiers in ${formatElapsed(Date.now() - loadStartedAt)}.`,
  );
  if (
    args.expectedCount !== null &&
    retainedIdentifiers.size !== args.expectedCount
  ) {
    throw new Error(
      `Retained Data.gov identifier count ${retainedIdentifiers.size.toLocaleString()} does not match expected ${args.expectedCount.toLocaleString()}.`,
    );
  }

  const apiKey = requirePersonalDataGovApiKey(env);
  console.log(
    `[semantics] Starting source-semantics traversal (pageSize=${args.pageSize.toLocaleString()}, progressEvery=${args.progressEveryPages} pages)...`,
  );
  const startedAt = Date.now();
  const probe = await probeDataGovSpatialSemantics({
    retainedIdentifiers,
    apiKey,
    searchUrl: args.searchUrl,
    pageSize: args.pageSize,
    maxPages: args.maxPages,
    progressEveryPages: args.progressEveryPages,
    sampleLimit: args.sampleLimit,
    onProgress: (progress) => {
      const elapsedMs = Date.now() - startedAt;
      const rate = Math.round(
        progress.sourceSpatialRowCount / Math.max(elapsedMs / 1000, 0.001),
      );
      const window = progress.window;
      console.log(
        `[semantics] pages=${window.startPage}-${window.endPage} block rows=${window.sourceSpatialRowCount.toLocaleString()} unique=${window.sourceSpatialRecordCount.toLocaleString()} C2=${window.retainedSpatialRecordCount.toLocaleString()} centroids=${window.centroidPresentCount.toLocaleString()} dcat=${window.dcatPresentCount.toLocaleString()}`,
      );
      console.log(
        `[semantics] cumulative pages=${progress.pagesFetched.toLocaleString()} rows=${progress.sourceSpatialRowCount.toLocaleString()} unique=${progress.sourceSpatialRecordCount.toLocaleString()} dup-rows=${progress.duplicateSourceRowCount.toLocaleString()} C2=${progress.retainedSpatialRecordCount.toLocaleString()} elapsed=${formatElapsed(elapsedMs)} rate=${rate.toLocaleString()} rows/s${progress.done ? ' complete' : ''}`,
      );
    },
  });

  const report = {
    ...probe,
    capturedAt: new Date().toISOString(),
    ...(scaleCertification ? { scaleCertification } : {}),
  };
  const resolvedOutputDir = path.resolve(args.outputDir);
  await mkdir(resolvedOutputDir, { recursive: true });
  const jsonPath = path.join(
    resolvedOutputDir,
    'data-gov-spatial-source-semantics.json',
  );
  const markdownPath = path.join(
    resolvedOutputDir,
    'data-gov-spatial-source-semantics.md',
  );
  await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  await writeFile(markdownPath, formatMarkdown(report), 'utf8');
  console.log(formatMarkdown(report));
  console.log(`JSON evidence: ${jsonPath}`);
  console.log(`Markdown evidence: ${markdownPath}`);
  return report;
}

export function formatMarkdown(report) {
  const lines = [
    '# Data.gov spatial source semantics',
    '',
    `- Captured: ${report.capturedAt ?? 'not captured'}`,
    '- Method: **current Data.gov v4 geospatial source intersected with certified retained C2 identifiers**',
    `- Retained Data.gov identifiers: **${formatNumber(report.retainedDataGovIdentifierCount)}**`,
    `- Retained C2 spatial matches: **${formatNumber(report.retainedSpatialRecordCount)}**`,
    `- Current geospatial rows / unique identifiers: **${formatNumber(report.sourceSpatialRowCount)} / ${formatNumber(report.sourceSpatialRecordCount)}**`,
    `- Duplicate rows collapsed: **${formatNumber(report.duplicateSourceRowCount)}** across **${formatNumber(report.duplicateSourceIdentifierCount)}** identifiers`,
    `- Pages fetched: **${formatNumber(report.pagesFetched)}**`,
    '',
  ];

  if (report.scaleCertification) {
    lines.push(
      '## Certified C2 binding',
      '',
      `- Profile: \`${report.scaleCertification.profile}\``,
      `- Scale evidence captured: ${report.scaleCertification.capturedAt}`,
      `- Composition SHA-256: \`${report.scaleCertification.compositionSha256}\``,
      `- Projection ID: \`${report.scaleCertification.projectionId}\``,
      `- Projection objects: **${formatNumber(report.scaleCertification.projectionObjectCount)}**`,
      '',
    );
  }

  lines.push(
    '## `spatial_centroid` semantics',
    '',
    `- Present: **${formatNumber(report.centroid.presentCount)}**`,
    `- Deterministically normalized points: **${formatNumber(report.centroid.normalizedPointCount)}**`,
    `- Valid normalized coordinates: **${formatNumber(report.centroid.validNormalizedPointCount)}**`,
    `- Out-of-range normalized coordinates: **${formatNumber(report.centroid.outOfRangeNormalizedPointCount)}**`,
    `- Compared to publisher shape bounds: **${formatNumber(report.centroid.comparedToShapeBoundsCount)}**`,
    `- Within publisher shape bounds: **${formatNumber(report.centroid.withinShapeBoundsCount)}**`,
    `- Matches publisher shape-bounds center: **${formatNumber(report.centroid.matchesShapeBoundsCenterCount)}**`,
    '',
    '| Representation family | Records |',
    '| --- | ---: |',
    ...sortedEntries(report.centroid.families).map(
      ([family, count]) =>
        `| \`${escapeMarkdown(family)}\` | ${formatNumber(count)} |`,
    ),
    '',
    '## `dcat.spatial` four-number ordering evidence',
    '',
    `- Present: **${formatNumber(report.dcatSpatial.presentCount)}**`,
    `- Four-number comma values: **${formatNumber(report.dcatSpatial.fourNumericCount)}**`,
    `- Compared to independent publisher shape bounds: **${formatNumber(report.dcatSpatial.fourNumericComparedToShapeCount)}**`,
    `- Exactly one ordering matched: **${formatNumber(report.dcatSpatial.uniqueOrderingMatchCount)}**`,
    `- Multiple orderings matched: **${formatNumber(report.dcatSpatial.ambiguousOrderingMatchCount)}**`,
    `- No tested ordering matched: **${formatNumber(report.dcatSpatial.noOrderingMatchCount)}**`,
    '',
    '| Inferred ordering | Records |',
    '| --- | ---: |',
    ...sortedEntries(report.dcatSpatial.inferredOrderings).map(
      ([ordering, count]) =>
        `| \`${escapeMarkdown(ordering)}\` | ${formatNumber(count)} |`,
    ),
    '',
    '### Representation families',
    '',
    '| Family | Records |',
    '| --- | ---: |',
    ...sortedEntries(report.dcatSpatial.families).map(
      ([family, count]) =>
        `| \`${escapeMarkdown(family)}\` | ${formatNumber(count)} |`,
    ),
    '',
    '## Interpretation',
    '',
    'This report resolves source representation semantics before the spatial sidecar is built. A centroid is normalized only when its representation deterministically identifies longitude and latitude and the coordinates are valid.',
    '',
    'A four-number `dcat.spatial` value is **not** treated as a canonical bounding box merely because it contains four numbers. Ordering is inferred only when one tested convention independently matches the publisher `spatial_shape` bounds. Unmatched or ambiguous values remain raw provenance.',
    '',
    'The publisher `spatial_shape` remains the primary geometry candidate. This command is read-only and does not mutate C2, activation state, search projection, or Data.gov source metadata.',
    '',
  );

  if (report.samples.length > 0) {
    lines.push(
      '## Bounded representation samples',
      '',
      '| Identifier | Centroid family | Centroid | In shape | DCAT family | Inferred ordering |',
      '| --- | --- | --- | --- | --- | --- |',
      ...report.samples.map(
        (sample) =>
          `| \`${escapeMarkdown(sample.identifier)}\` | ${escapeMarkdown(sample.centroidFamily ?? '')} | ${escapeMarkdown(sample.centroidPoint ? `${sample.centroidPoint.lon},${sample.centroidPoint.lat}` : '')} | ${sample.centroidWithinShapeBounds === null ? '' : sample.centroidWithinShapeBounds ? 'yes' : 'no'} | ${escapeMarkdown(sample.dcatFamily ?? '')} | ${escapeMarkdown(sample.inferredOrdering ?? sample.orderingMatches.join('+'))} |`,
      ),
      '',
    );
  }

  return `${lines.join('\n')}\n`;
}

function semanticsObservation(dataset) {
  const shape = isObject(dataset?.spatial_shape)
    ? analyzeGeoJsonGeometry(dataset.spatial_shape)
    : null;
  const shapeBounds =
    shape?.structurallyValid && shape.bounds ? shape.bounds : null;
  const centroid = classifyCentroid(dataset?.spatial_centroid);
  const dcat = classifyDcatSpatialSemantics(
    dataset?.dcat?.spatial,
    shapeBounds,
  );
  return {
    title: textValue(dataset?.title),
    shapeBounds,
    centroid,
    centroidSignature: stableString(dataset?.spatial_centroid),
    dcat,
    dcatSignature: textValue(dataset?.dcat?.spatial),
    centroidVariant: false,
    dcatVariant: false,
  };
}

function mergeObservation(current, incoming) {
  return {
    title: current.title ?? incoming.title,
    shapeBounds: current.shapeBounds ?? incoming.shapeBounds,
    centroid: chooseCentroid(current.centroid, incoming.centroid),
    centroidSignature: current.centroidSignature ?? incoming.centroidSignature,
    dcat: chooseDcat(current.dcat, incoming.dcat),
    dcatSignature: current.dcatSignature ?? incoming.dcatSignature,
    centroidVariant:
      current.centroidVariant ||
      Boolean(
        current.centroidSignature &&
          incoming.centroidSignature &&
          current.centroidSignature !== incoming.centroidSignature,
      ),
    dcatVariant:
      current.dcatVariant ||
      Boolean(
        current.dcatSignature &&
          incoming.dcatSignature &&
          current.dcatSignature !== incoming.dcatSignature,
      ),
  };
}

function chooseCentroid(current, incoming) {
  if (!current) return incoming;
  if (!incoming) return current;
  if (!current.validCoordinates && incoming.validCoordinates) return incoming;
  if (!current.point && incoming.point) return incoming;
  return current;
}

function chooseDcat(current, incoming) {
  if (!current) return incoming;
  if (!incoming) return current;
  if (!current.inferredOrdering && incoming.inferredOrdering) return incoming;
  return current;
}

function centroidResult(family, point, extra = {}) {
  return {
    family,
    point,
    validCoordinates: validPoint(point),
    ...extra,
  };
}

function pointFromLonLat(value) {
  if (!Array.isArray(value) || value.length < 2) return null;
  const lon = finiteNumber(value[0]);
  const lat = finiteNumber(value[1]);
  if (lon === null || lat === null) return null;
  return { lon, lat };
}

function validPoint(point) {
  return Boolean(
    point &&
      Number.isFinite(point.lon) &&
      Number.isFinite(point.lat) &&
      point.lon >= -180 &&
      point.lon <= 180 &&
      point.lat >= -90 &&
      point.lat <= 90,
  );
}

function validBounds(bounds) {
  return Boolean(
    bounds &&
      Number.isFinite(bounds.minLon) &&
      Number.isFinite(bounds.minLat) &&
      Number.isFinite(bounds.maxLon) &&
      Number.isFinite(bounds.maxLat),
  );
}

function approximately(left, right, tolerance) {
  return Math.abs(left - right) <= tolerance;
}

function finiteNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function interestingObservation(observation) {
  return Boolean(
    (observation.centroid &&
      observation.centroid.family !== 'geojson-point-object') ||
      (observation.dcat?.family === 'comma-four-numeric' &&
        (observation.dcat.orderingMatches.length !== 1 ||
          observation.dcat.inferredOrdering !== 'west-south-east-north')),
  );
}

function progressSnapshot(values = {}) {
  return {
    pagesFetched: values.pagesFetched ?? 0,
    sourceSpatialRowCount: values.sourceSpatialRowCount ?? 0,
    sourceSpatialRecordCount: values.sourceSpatialRecordCount ?? 0,
    duplicateSourceRowCount: values.duplicateSourceRowCount ?? 0,
    retainedSpatialRecordCount: values.retainedSpatialRecordCount ?? 0,
    centroidPresentCount: values.centroidPresentCount ?? 0,
    dcatPresentCount: values.dcatPresentCount ?? 0,
  };
}

function differenceSnapshot(current, previous) {
  return {
    startPage: previous.pagesFetched + 1,
    endPage: current.pagesFetched,
    sourceSpatialRowCount:
      current.sourceSpatialRowCount - previous.sourceSpatialRowCount,
    sourceSpatialRecordCount:
      current.sourceSpatialRecordCount - previous.sourceSpatialRecordCount,
    duplicateSourceRowCount:
      current.duplicateSourceRowCount - previous.duplicateSourceRowCount,
    retainedSpatialRecordCount:
      current.retainedSpatialRecordCount - previous.retainedSpatialRecordCount,
    centroidPresentCount:
      current.centroidPresentCount - previous.centroidPresentCount,
    dcatPresentCount: current.dcatPresentCount - previous.dcatPresentCount,
  };
}

function countSignal(observations, field) {
  let count = 0;
  for (const observation of observations.values()) {
    if (observation[field]) count += 1;
  }
  return count;
}

function sourceIdentifier(dataset) {
  return textValue(dataset?.identifier) ?? textValue(dataset?.dcat?.identifier);
}

function requireNonDemoApiKey(apiKey) {
  const value = String(apiKey ?? '').trim();
  if (!value || value === 'DEMO_KEY') {
    throw new Error(
      'A personal Data.gov API key is required for the full spatial semantics traversal.',
    );
  }
  return value;
}

function positiveInteger(value, name, maximum = Number.MAX_SAFE_INTEGER) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > maximum) {
    throw new Error(`${name} must be an integer from 1 through ${maximum}.`);
  }
  return parsed;
}

function nonNegativeInteger(value, name) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`${name} must be a non-negative integer.`);
  }
  return parsed;
}

function requiredText(value, name) {
  const text = textValue(value);
  if (!text) throw new Error(`${name} requires a value.`);
  return text;
}

function textValue(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function stableString(value) {
  if (value === null || value === undefined) return null;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function isObject(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function increment(target, key) {
  target[key] = (target[key] ?? 0) + 1;
}

function sortedEntries(value) {
  return Object.entries(value ?? {}).sort(([left], [right]) =>
    left.localeCompare(right),
  );
}

function formatNumber(value) {
  return Number(value ?? 0).toLocaleString('en-US');
}

function escapeMarkdown(value) {
  return String(value ?? '')
    .replaceAll('|', '\\|')
    .replaceAll('\n', ' ');
}

function formatElapsed(milliseconds) {
  const seconds = milliseconds / 1000;
  return seconds < 10 ? `${seconds.toFixed(1)}s` : `${seconds.toFixed(0)}s`;
}

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) ===
    path.resolve(fileURLToPath(import.meta.url));
if (isMain) await run();
