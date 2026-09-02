import { createHash } from 'node:crypto';
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

const DEFAULT_OUTPUT_DIR = 'browser-evidence-artifacts/spatial-geometry';
const DEFAULT_SEARCH_URL = 'https://api.gsa.gov/technology/datagov/v4/search';
const DEFAULT_PAGE_SIZE = 1_000;
const DEFAULT_MAX_PAGES = 2_000;
const DEFAULT_PROGRESS_EVERY_PAGES = 100;
const DEFAULT_SAMPLE_LIMIT = 20;
const MAX_PAGE_SIZE = 1_000;
const GEOJSON_TYPES = new Set([
  'Point',
  'MultiPoint',
  'LineString',
  'MultiLineString',
  'Polygon',
  'MultiPolygon',
  'GeometryCollection',
]);

export function analyzeGeoJsonGeometry(value) {
  if (!isObject(value)) {
    return null;
  }

  const serialized = JSON.stringify(value);
  const state = newGeometryState();
  inspectGeometry(value, state);
  const hasBounds = Number.isFinite(state.minLon) && Number.isFinite(state.maxLon);
  return {
    type: textValue(value.type) ?? 'UNKNOWN',
    recognizedType: GEOJSON_TYPES.has(textValue(value.type) ?? ''),
    structurallyValid: state.structurallyValid,
    empty: state.positionCount === 0,
    positionCount: state.positionCount,
    serializedBytes: Buffer.byteLength(serialized, 'utf8'),
    invalidPositionCount: state.invalidPositionCount,
    outOfRangePositionCount: state.outOfRangePositionCount,
    ringClosureFailureCount: state.ringClosureFailureCount,
    insufficientElementCount: state.insufficientElementCount,
    longitudeSpanDegrees: hasBounds ? state.maxLon - state.minLon : null,
    longitudeSpanOver180:
      hasBounds && state.maxLon - state.minLon > 180,
    bounds: hasBounds
      ? {
          minLon: state.minLon,
          minLat: state.minLat,
          maxLon: state.maxLon,
          maxLat: state.maxLat,
        }
      : null,
  };
}

export function analyzeCentroid(value) {
  const analysis = analyzeGeoJsonGeometry(value);
  if (!analysis) {
    return null;
  }
  return {
    ...analysis,
    validPoint:
      analysis.type === 'Point' &&
      analysis.structurallyValid &&
      !analysis.empty &&
      analysis.positionCount === 1 &&
      analysis.outOfRangePositionCount === 0,
  };
}

export function classifyDcatSpatial(value) {
  const text = textValue(value);
  if (!text) {
    return null;
  }

  if (text.startsWith('{') || text.startsWith('[')) {
    try {
      const parsed = JSON.parse(text);
      return {
        family: Array.isArray(parsed) ? 'json-array' : 'json-object',
        bbox: null,
        anomalies: [],
      };
    } catch {
      return { family: 'json-like-invalid', bbox: null, anomalies: [] };
    }
  }

  const commaParts = text.split(',').map((part) => part.trim());
  const commaNumbers = commaParts.map((part) => Number(part));
  if (
    commaParts.length === 4 &&
    commaNumbers.every((number) => Number.isFinite(number))
  ) {
    const [west, south, east, north] = commaNumbers;
    const anomalies = [];
    if (west < -180 || west > 180 || east < -180 || east > 180) {
      anomalies.push('longitude-out-of-range');
    }
    if (south < -90 || south > 90 || north < -90 || north > 90) {
      anomalies.push('latitude-out-of-range');
    }
    if (west > east) anomalies.push('west-greater-than-east');
    if (south > north) anomalies.push('south-greater-than-north');
    if (Math.abs(east - west) > 180) {
      anomalies.push('longitude-span-over-180');
    }
    return {
      family: 'comma-bbox-four-numeric',
      bbox: { west, south, east, north },
      anomalies,
    };
  }

  if (
    commaParts.length > 1 &&
    commaNumbers.every((number) => Number.isFinite(number))
  ) {
    return { family: 'comma-numeric-other', bbox: null, anomalies: [] };
  }

  return { family: 'free-text', bbox: null, anomalies: [] };
}

export async function probeDataGovSpatialGeometry({
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
  if (onProgress !== null && typeof onProgress !== 'function') {
    throw new Error('onProgress must be a function when provided.');
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
  const retainedObservations = new Map();
  let pages = 0;
  let sourceSpatialRowCount = 0;
  let duplicateSourceRowCount = 0;
  let previousProgressSnapshot = {
    pagesFetched: 0,
    sourceSpatialRowCount: 0,
    sourceSpatialRecordCount: 0,
    duplicateSourceRowCount: 0,
    retainedSpatialRecordCount: 0,
    retainedShapeRecordCount: 0,
    retainedCentroidRecordCount: 0,
  };
  let cursor = null;

  while (true) {
    if (pages >= safeMaxPages) {
      throw new Error(
        `Data.gov spatial geometry census reached maxPages=${safeMaxPages} before the source cursor completed.`,
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
        `Data.gov spatial geometry census hit HTTP 429 rate limiting${retryAfter ? `; retry after ${retryAfter}` : ''}.`,
      );
    }
    if (!response.ok) {
      throw new Error(
        `Data.gov spatial geometry census request failed with HTTP ${response.status}: ${url}`,
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
      sourceSpatialRowCount += 1;
      if (seenSourceIdentifiers.has(identifier)) {
        duplicateSourceRowCount += 1;
        duplicateSourceIdentifiers.add(identifier);
      } else {
        seenSourceIdentifiers.add(identifier);
      }

      if (!retainedIdentifiers.has(identifier)) {
        continue;
      }

      const incoming = observationFromDataset(dataset);
      const current = retainedObservations.get(identifier);
      retainedObservations.set(
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

    if (onProgress && (pages % safeProgressEveryPages === 0 || done)) {
      const currentProgressSnapshot = {
        pagesFetched: pages,
        sourceSpatialRowCount,
        sourceSpatialRecordCount: seenSourceIdentifiers.size,
        duplicateSourceRowCount,
        retainedSpatialRecordCount: retainedObservations.size,
        retainedShapeRecordCount: countObservationSignal(
          retainedObservations,
          'shape',
        ),
        retainedCentroidRecordCount: countObservationSignal(
          retainedObservations,
          'centroid',
        ),
      };
      onProgress({
        ...currentProgressSnapshot,
        window: differenceSnapshot(
          currentProgressSnapshot,
          previousProgressSnapshot,
        ),
        done,
      });
      previousProgressSnapshot = currentProgressSnapshot;
    }

    if (done) break;
    cursor = nextCursor;
  }

  return summarizeGeometryCensus({
    retainedIdentifiers,
    retainedObservations,
    sourceSpatialRowCount,
    sourceSpatialRecordCount: seenSourceIdentifiers.size,
    duplicateSourceRowCount,
    duplicateSourceIdentifierCount: duplicateSourceIdentifiers.size,
    pagesFetched: pages,
    sampleLimit: safeSampleLimit,
  });
}

export function summarizeGeometryCensus({
  retainedIdentifiers,
  retainedObservations,
  sourceSpatialRowCount,
  sourceSpatialRecordCount,
  duplicateSourceRowCount,
  duplicateSourceIdentifierCount,
  pagesFetched,
  sampleLimit = DEFAULT_SAMPLE_LIMIT,
}) {
  const shape = newShapeSummary();
  const centroid = newCentroidSummary();
  const dcatSpatial = newDcatSummary();
  const samples = [];
  const shapePositionCounts = [];
  const shapeSerializedBytes = [];

  for (const [identifier, observation] of retainedObservations) {
    if (observation.shape) {
      shape.presentCount += 1;
      increment(shape.types, observation.shape.type);
      if (observation.shape.recognizedType) shape.recognizedTypeCount += 1;
      else shape.unrecognizedTypeCount += 1;
      if (observation.shape.structurallyValid) shape.structurallyValidCount += 1;
      else shape.structurallyInvalidCount += 1;
      if (observation.shape.empty) shape.emptyCount += 1;
      if (observation.shape.invalidPositionCount > 0)
        shape.invalidPositionRecordCount += 1;
      if (observation.shape.outOfRangePositionCount > 0)
        shape.outOfRangeRecordCount += 1;
      if (observation.shape.ringClosureFailureCount > 0)
        shape.ringClosureFailureRecordCount += 1;
      if (observation.shape.insufficientElementCount > 0)
        shape.insufficientElementRecordCount += 1;
      if (observation.shape.longitudeSpanOver180)
        shape.longitudeSpanOver180RecordCount += 1;
      shapePositionCounts.push(observation.shape.positionCount);
      shapeSerializedBytes.push(observation.shape.serializedBytes);
      increment(
        shape.complexityBuckets,
        complexityBucket(observation.shape.positionCount),
      );
      increment(
        shape.serializedSizeBuckets,
        sizeBucket(observation.shape.serializedBytes),
      );
    }
    if (observation.shapeVariant) shape.variantIdentifierCount += 1;

    if (observation.centroid) {
      centroid.presentCount += 1;
      if (observation.centroid.validPoint) centroid.validPointCount += 1;
      else centroid.invalidCount += 1;
      if (observation.centroid.outOfRangePositionCount > 0)
        centroid.outOfRangeRecordCount += 1;
    }
    if (observation.centroidVariant) centroid.variantIdentifierCount += 1;

    if (observation.dcatSpatial) {
      dcatSpatial.presentCount += 1;
      increment(dcatSpatial.families, observation.dcatSpatial.family);
      const anomalies = observation.dcatSpatial.anomalies;
      if (anomalies.includes('longitude-out-of-range'))
        dcatSpatial.longitudeOutOfRangeCount += 1;
      if (anomalies.includes('latitude-out-of-range'))
        dcatSpatial.latitudeOutOfRangeCount += 1;
      if (anomalies.includes('west-greater-than-east'))
        dcatSpatial.westGreaterThanEastCount += 1;
      if (anomalies.includes('south-greater-than-north'))
        dcatSpatial.southGreaterThanNorthCount += 1;
      if (anomalies.includes('longitude-span-over-180'))
        dcatSpatial.longitudeSpanOver180Count += 1;
    }
    if (observation.dcatVariant) dcatSpatial.variantIdentifierCount += 1;

    if (samples.length < sampleLimit && hasInterestingAnomaly(observation)) {
      samples.push({
        identifier,
        title: observation.title,
        shapeType: observation.shape?.type ?? null,
        shapePositionCount: observation.shape?.positionCount ?? null,
        shapeSerializedBytes: observation.shape?.serializedBytes ?? null,
        shapeStructurallyValid: observation.shape?.structurallyValid ?? null,
        centroidValidPoint: observation.centroid?.validPoint ?? null,
        dcatSpatialFamily: observation.dcatSpatial?.family ?? null,
        anomalies: observationAnomalies(observation),
      });
    }
  }

  shape.absentCount = retainedObservations.size - shape.presentCount;
  centroid.absentCount = retainedObservations.size - centroid.presentCount;
  dcatSpatial.absentCount = retainedObservations.size - dcatSpatial.presentCount;
  shape.positionCountPercentiles = percentiles(shapePositionCounts);
  shape.serializedBytesPercentiles = percentiles(shapeSerializedBytes);

  return {
    kind: 'data-gov-spatial-geometry-census',
    schemaVersion: 1,
    method: 'data-gov-v4-geospatial-geometry-census-intersection',
    retainedDataGovIdentifierCount: retainedIdentifiers.size,
    retainedSpatialRecordCount: retainedObservations.size,
    sourceSpatialRowCount,
    sourceSpatialRecordCount,
    duplicateSourceRowCount,
    duplicateSourceIdentifierCount,
    sourceSpatialOutsideRetainedCount:
      sourceSpatialRecordCount - retainedObservations.size,
    pagesFetched,
    shape,
    centroid,
    dcatSpatial,
    anomalySamples: samples,
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
      args.sampleLimit = nonNegativeInteger(
        argv[index + 1],
        '--sample-limit',
      );
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

  console.log('[geometry] Loading retained Data.gov identifiers from C2...');
  const loadStartedAt = Date.now();
  const retainedIdentifiers = parsePsqlIdentifiers(
    runPsqlIdentifiers(buildRetainedIdentifiersSql(), env),
  );
  console.log(
    `[geometry] Loaded ${retainedIdentifiers.size.toLocaleString()} retained identifiers in ${formatElapsed(Date.now() - loadStartedAt)}.`,
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
    `[geometry] Starting Data.gov geometry census (pageSize=${args.pageSize.toLocaleString()}, progressEvery=${args.progressEveryPages} pages)...`,
  );
  const traversalStartedAt = Date.now();
  const probe = await probeDataGovSpatialGeometry({
    retainedIdentifiers,
    apiKey,
    searchUrl: args.searchUrl,
    pageSize: args.pageSize,
    maxPages: args.maxPages,
    progressEveryPages: args.progressEveryPages,
    sampleLimit: args.sampleLimit,
    onProgress: (progress) => {
      const elapsedMs = Date.now() - traversalStartedAt;
      const elapsedSeconds = Math.max(elapsedMs / 1000, 0.001);
      const rate = Math.round(progress.sourceSpatialRowCount / elapsedSeconds);
      const window = progress.window;
      console.log(
        `[geometry] pages=${window.startPage.toLocaleString()}-${window.endPage.toLocaleString()} block rows=${window.sourceSpatialRowCount.toLocaleString()} unique=${window.sourceSpatialRecordCount.toLocaleString()} dup-rows=${window.duplicateSourceRowCount.toLocaleString()} C2=${window.retainedSpatialRecordCount.toLocaleString()} shapes=${window.retainedShapeRecordCount.toLocaleString()} centroids=${window.retainedCentroidRecordCount.toLocaleString()}`,
      );
      console.log(
        `[geometry] cumulative pages=${progress.pagesFetched.toLocaleString()} rows=${progress.sourceSpatialRowCount.toLocaleString()} unique=${progress.sourceSpatialRecordCount.toLocaleString()} dup-rows=${progress.duplicateSourceRowCount.toLocaleString()} C2=${progress.retainedSpatialRecordCount.toLocaleString()} shapes=${progress.retainedShapeRecordCount.toLocaleString()} centroids=${progress.retainedCentroidRecordCount.toLocaleString()} elapsed=${formatElapsed(elapsedMs)} rate=${rate.toLocaleString()} rows/s${progress.done ? ' complete' : ''}`,
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
    'data-gov-spatial-geometry-census.json',
  );
  const markdownPath = path.join(
    resolvedOutputDir,
    'data-gov-spatial-geometry-census.md',
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
    '# Data.gov spatial geometry census',
    '',
    `- Captured: ${report.capturedAt ?? 'not captured'}`,
    '- Method: **Data.gov v4 geospatial search intersected with certified retained C2 identifiers**',
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
    '## Publisher-supplied shape census',
    '',
    `- Shape present: **${formatNumber(report.shape.presentCount)}**`,
    `- Structurally valid: **${formatNumber(report.shape.structurallyValidCount)}**`,
    `- Structurally invalid: **${formatNumber(report.shape.structurallyInvalidCount)}**`,
    `- Empty shapes: **${formatNumber(report.shape.emptyCount)}**`,
    `- Out-of-range coordinate records: **${formatNumber(report.shape.outOfRangeRecordCount)}**`,
    `- Longitude span > 180° candidates: **${formatNumber(report.shape.longitudeSpanOver180RecordCount)}**`,
    `- Duplicate identifiers with differing shape observations: **${formatNumber(report.shape.variantIdentifierCount)}**`,
    '',
    '| Geometry type | Records |',
    '| --- | ---: |',
    ...sortedEntries(report.shape.types).map(
      ([type, count]) => `| \`${escapeMarkdown(type)}\` | ${formatNumber(count)} |`,
    ),
    '',
    '### Shape complexity',
    '',
    `- Positions p50 / p90 / p95 / p99 / max: **${percentileText(report.shape.positionCountPercentiles)}**`,
    `- Serialized bytes p50 / p90 / p95 / p99 / max: **${percentileText(report.shape.serializedBytesPercentiles)}**`,
    '',
    '| Position bucket | Records |',
    '| --- | ---: |',
    ...orderedBucketEntries(report.shape.complexityBuckets, [
      '0-5',
      '6-50',
      '51-500',
      '501-5000',
      '5001+',
    ]).map(([bucket, count]) => `| ${bucket} | ${formatNumber(count)} |`),
    '',
    '| Serialized size | Records |',
    '| --- | ---: |',
    ...orderedBucketEntries(report.shape.serializedSizeBuckets, [
      '<=1KiB',
      '1-10KiB',
      '10-100KiB',
      '100KiB-1MiB',
      '>1MiB',
    ]).map(([bucket, count]) => `| ${bucket} | ${formatNumber(count)} |`),
    '',
    '## Centroid census',
    '',
    `- Centroid present: **${formatNumber(report.centroid.presentCount)}**`,
    `- Valid GeoJSON Point: **${formatNumber(report.centroid.validPointCount)}**`,
    `- Invalid / non-Point: **${formatNumber(report.centroid.invalidCount)}**`,
    `- Out-of-range centroid records: **${formatNumber(report.centroid.outOfRangeRecordCount)}**`,
    '',
    '## `dcat.spatial` representation census',
    '',
    `- Present: **${formatNumber(report.dcatSpatial.presentCount)}**`,
    `- West > east ordering observations: **${formatNumber(report.dcatSpatial.westGreaterThanEastCount)}**`,
    `- South > north ordering observations: **${formatNumber(report.dcatSpatial.southGreaterThanNorthCount)}**`,
    `- Longitude span > 180° observations: **${formatNumber(report.dcatSpatial.longitudeSpanOver180Count)}**`,
    '',
    '| Representation family | Records |',
    '| --- | ---: |',
    ...sortedEntries(report.dcatSpatial.families).map(
      ([family, count]) =>
        `| \`${escapeMarkdown(family)}\` | ${formatNumber(count)} |`,
    ),
    '',
    '## Interpretation',
    '',
    'This census measures structural GeoJSON characteristics and coordinate-domain anomalies in the current Data.gov v4 source representation intersected with certified C2 identifiers. It is **not** a topological-validity certification and does not prove that a polygon is semantically correct research coverage.',
    '',
    'Publisher-supplied `spatial_shape` is the primary candidate for a future versioned sidecar when structurally valid. `spatial_centroid` is separately assessed as point evidence. Raw `dcat.spatial` text remains provenance/fallback evidence and must not be naively interpreted as west/south/east/north when ordering or antimeridian anomalies are present.',
    '',
    'This command is read-only. It does not mutate C2, activation state, search projection, or Data.gov source metadata.',
    '',
  );

  if (report.anomalySamples.length > 0) {
    lines.push(
      '## Bounded anomaly samples',
      '',
      '| Identifier | Shape | Positions | Bytes | Anomalies |',
      '| --- | --- | ---: | ---: | --- |',
      ...report.anomalySamples.map(
        (sample) =>
          `| \`${escapeMarkdown(sample.identifier)}\` | ${escapeMarkdown(sample.shapeType ?? '')} | ${formatNumber(sample.shapePositionCount ?? 0)} | ${formatNumber(sample.shapeSerializedBytes ?? 0)} | ${escapeMarkdown(sample.anomalies.join(', '))} |`,
      ),
      '',
    );
  }

  return `${lines.join('\n')}\n`;
}

function observationFromDataset(dataset) {
  const shapeValue = isObject(dataset?.spatial_shape)
    ? dataset.spatial_shape
    : null;
  const centroidValue = isObject(dataset?.spatial_centroid)
    ? dataset.spatial_centroid
    : null;
  const dcatRaw = textValue(dataset?.dcat?.spatial);
  return {
    title: textValue(dataset?.title),
    hasSpatialTrue: dataset?.has_spatial === true,
    shape: shapeValue ? analyzeGeoJsonGeometry(shapeValue) : null,
    shapeHash: shapeValue ? hashJson(shapeValue) : null,
    centroid: centroidValue ? analyzeCentroid(centroidValue) : null,
    centroidHash: centroidValue ? hashJson(centroidValue) : null,
    dcatSpatial: classifyDcatSpatial(dcatRaw),
    dcatHash: dcatRaw ? hashText(dcatRaw) : null,
    shapeVariant: false,
    centroidVariant: false,
    dcatVariant: false,
  };
}

function mergeObservation(current, incoming) {
  return {
    title: current.title ?? incoming.title,
    hasSpatialTrue: current.hasSpatialTrue || incoming.hasSpatialTrue,
    shape: choosePreferredGeometry(current.shape, incoming.shape),
    shapeHash: preferredHash(
      current.shape,
      current.shapeHash,
      incoming.shape,
      incoming.shapeHash,
    ),
    centroid: choosePreferredCentroid(current.centroid, incoming.centroid),
    centroidHash: preferredCentroidHash(
      current.centroid,
      current.centroidHash,
      incoming.centroid,
      incoming.centroidHash,
    ),
    dcatSpatial: current.dcatSpatial ?? incoming.dcatSpatial,
    dcatHash: current.dcatHash ?? incoming.dcatHash,
    shapeVariant:
      current.shapeVariant ||
      Boolean(
        current.shapeHash &&
          incoming.shapeHash &&
          current.shapeHash !== incoming.shapeHash,
      ),
    centroidVariant:
      current.centroidVariant ||
      Boolean(
        current.centroidHash &&
          incoming.centroidHash &&
          current.centroidHash !== incoming.centroidHash,
      ),
    dcatVariant:
      current.dcatVariant ||
      Boolean(
        current.dcatHash &&
          incoming.dcatHash &&
          current.dcatHash !== incoming.dcatHash,
      ),
  };
}

function preferredHash(current, currentHash, incoming, incomingHash) {
  return choosePreferredGeometry(current, incoming) === incoming
    ? incomingHash
    : currentHash;
}

function preferredCentroidHash(current, currentHash, incoming, incomingHash) {
  return choosePreferredCentroid(current, incoming) === incoming
    ? incomingHash
    : currentHash;
}

function choosePreferredGeometry(current, incoming) {
  if (!current) return incoming;
  if (!incoming) return current;
  if (!current.structurallyValid && incoming.structurallyValid) return incoming;
  if (current.empty && !incoming.empty) return incoming;
  return current;
}

function choosePreferredCentroid(current, incoming) {
  if (!current) return incoming;
  if (!incoming) return current;
  if (!current.validPoint && incoming.validPoint) return incoming;
  return current;
}

function newGeometryState() {
  return {
    structurallyValid: true,
    positionCount: 0,
    invalidPositionCount: 0,
    outOfRangePositionCount: 0,
    ringClosureFailureCount: 0,
    insufficientElementCount: 0,
    minLon: Number.POSITIVE_INFINITY,
    minLat: Number.POSITIVE_INFINITY,
    maxLon: Number.NEGATIVE_INFINITY,
    maxLat: Number.NEGATIVE_INFINITY,
  };
}

function inspectGeometry(geometry, state) {
  const type = textValue(geometry?.type);
  if (!type || !GEOJSON_TYPES.has(type)) {
    state.structurallyValid = false;
    return;
  }
  if (type === 'GeometryCollection') {
    if (!Array.isArray(geometry.geometries)) {
      state.structurallyValid = false;
      return;
    }
    for (const child of geometry.geometries) {
      if (!isObject(child)) {
        state.structurallyValid = false;
        continue;
      }
      inspectGeometry(child, state);
    }
    return;
  }

  const coordinates = geometry.coordinates;
  switch (type) {
    case 'Point':
      inspectPosition(coordinates, state);
      break;
    case 'MultiPoint':
      inspectPositionArray(coordinates, 1, state);
      break;
    case 'LineString':
      inspectPositionArray(coordinates, 2, state);
      break;
    case 'MultiLineString':
      inspectNestedPositionArrays(coordinates, 1, 2, state, false);
      break;
    case 'Polygon':
      inspectPolygon(coordinates, state);
      break;
    case 'MultiPolygon':
      if (!Array.isArray(coordinates)) {
        state.structurallyValid = false;
        return;
      }
      if (coordinates.length === 0) state.insufficientElementCount += 1;
      for (const polygon of coordinates) inspectPolygon(polygon, state);
      break;
    default:
      state.structurallyValid = false;
  }
}

function inspectNestedPositionArrays(
  value,
  minimumOuter,
  minimumInner,
  state,
  ring,
) {
  if (!Array.isArray(value)) {
    state.structurallyValid = false;
    return;
  }
  if (value.length < minimumOuter) state.insufficientElementCount += 1;
  for (const item of value) {
    inspectPositionArray(item, minimumInner, state, ring);
  }
}

function inspectPolygon(value, state) {
  inspectNestedPositionArrays(value, 1, 4, state, true);
}

function inspectPositionArray(value, minimum, state, ring = false) {
  if (!Array.isArray(value)) {
    state.structurallyValid = false;
    return;
  }
  if (value.length < minimum) {
    state.insufficientElementCount += 1;
    state.structurallyValid = false;
  }
  for (const position of value) inspectPosition(position, state);
  if (ring && value.length > 0 && !samePosition(value[0], value.at(-1))) {
    state.ringClosureFailureCount += 1;
    state.structurallyValid = false;
  }
}

function inspectPosition(value, state) {
  state.positionCount += 1;
  if (
    !Array.isArray(value) ||
    value.length < 2 ||
    value.some((coordinate) => !Number.isFinite(coordinate))
  ) {
    state.invalidPositionCount += 1;
    state.structurallyValid = false;
    return;
  }
  const [lon, lat] = value;
  if (lon < -180 || lon > 180 || lat < -90 || lat > 90) {
    state.outOfRangePositionCount += 1;
    state.structurallyValid = false;
  }
  state.minLon = Math.min(state.minLon, lon);
  state.minLat = Math.min(state.minLat, lat);
  state.maxLon = Math.max(state.maxLon, lon);
  state.maxLat = Math.max(state.maxLat, lat);
}

function samePosition(left, right) {
  return (
    Array.isArray(left) &&
    Array.isArray(right) &&
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

function differenceSnapshot(current, previous) {
  return {
    startPage: previous.pagesFetched + 1,
    endPage: current.pagesFetched,
    pagesFetched: current.pagesFetched - previous.pagesFetched,
    sourceSpatialRowCount:
      current.sourceSpatialRowCount - previous.sourceSpatialRowCount,
    sourceSpatialRecordCount:
      current.sourceSpatialRecordCount - previous.sourceSpatialRecordCount,
    duplicateSourceRowCount:
      current.duplicateSourceRowCount - previous.duplicateSourceRowCount,
    retainedSpatialRecordCount:
      current.retainedSpatialRecordCount - previous.retainedSpatialRecordCount,
    retainedShapeRecordCount:
      current.retainedShapeRecordCount - previous.retainedShapeRecordCount,
    retainedCentroidRecordCount:
      current.retainedCentroidRecordCount - previous.retainedCentroidRecordCount,
  };
}

function countObservationSignal(observations, key) {
  let count = 0;
  for (const observation of observations.values()) {
    if (observation[key]) count += 1;
  }
  return count;
}

function newShapeSummary() {
  return {
    presentCount: 0,
    absentCount: 0,
    recognizedTypeCount: 0,
    unrecognizedTypeCount: 0,
    structurallyValidCount: 0,
    structurallyInvalidCount: 0,
    emptyCount: 0,
    invalidPositionRecordCount: 0,
    outOfRangeRecordCount: 0,
    ringClosureFailureRecordCount: 0,
    insufficientElementRecordCount: 0,
    longitudeSpanOver180RecordCount: 0,
    variantIdentifierCount: 0,
    types: {},
    complexityBuckets: {},
    serializedSizeBuckets: {},
    positionCountPercentiles: null,
    serializedBytesPercentiles: null,
  };
}

function newCentroidSummary() {
  return {
    presentCount: 0,
    absentCount: 0,
    validPointCount: 0,
    invalidCount: 0,
    outOfRangeRecordCount: 0,
    variantIdentifierCount: 0,
  };
}

function newDcatSummary() {
  return {
    presentCount: 0,
    absentCount: 0,
    families: {},
    longitudeOutOfRangeCount: 0,
    latitudeOutOfRangeCount: 0,
    westGreaterThanEastCount: 0,
    southGreaterThanNorthCount: 0,
    longitudeSpanOver180Count: 0,
    variantIdentifierCount: 0,
  };
}

function hasInterestingAnomaly(observation) {
  return observationAnomalies(observation).length > 0;
}

function observationAnomalies(observation) {
  const anomalies = [];
  if (observation.shape && !observation.shape.structurallyValid)
    anomalies.push('shape-structurally-invalid');
  if (observation.shape?.longitudeSpanOver180)
    anomalies.push('shape-longitude-span-over-180');
  if (observation.centroid && !observation.centroid.validPoint)
    anomalies.push('centroid-invalid');
  if (observation.dcatSpatial?.anomalies?.length)
    anomalies.push(
      ...observation.dcatSpatial.anomalies.map((item) => `dcat-${item}`),
    );
  if (observation.shapeVariant) anomalies.push('duplicate-shape-variant');
  if (observation.centroidVariant) anomalies.push('duplicate-centroid-variant');
  if (observation.dcatVariant) anomalies.push('duplicate-dcat-variant');
  return anomalies;
}

function complexityBucket(positionCount) {
  if (positionCount <= 5) return '0-5';
  if (positionCount <= 50) return '6-50';
  if (positionCount <= 500) return '51-500';
  if (positionCount <= 5_000) return '501-5000';
  return '5001+';
}

function sizeBucket(bytes) {
  if (bytes <= 1_024) return '<=1KiB';
  if (bytes <= 10 * 1_024) return '1-10KiB';
  if (bytes <= 100 * 1_024) return '10-100KiB';
  if (bytes <= 1_024 * 1_024) return '100KiB-1MiB';
  return '>1MiB';
}

function percentiles(values) {
  if (values.length === 0) {
    return { p50: 0, p90: 0, p95: 0, p99: 0, max: 0 };
  }
  const sorted = [...values].sort((a, b) => a - b);
  return {
    p50: percentile(sorted, 0.5),
    p90: percentile(sorted, 0.9),
    p95: percentile(sorted, 0.95),
    p99: percentile(sorted, 0.99),
    max: sorted.at(-1),
  };
}

function percentile(sorted, fraction) {
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil(sorted.length * fraction) - 1),
  );
  return sorted[index];
}

function hashJson(value) {
  return hashText(JSON.stringify(value));
}

function hashText(value) {
  return createHash('sha256').update(String(value)).digest('hex');
}

function sourceIdentifier(dataset) {
  return textValue(dataset?.identifier) ?? textValue(dataset?.dcat?.identifier);
}

function requireNonDemoApiKey(apiKey) {
  const normalized = String(apiKey ?? '').trim();
  if (!normalized || normalized === 'DEMO_KEY') {
    throw new Error('A personal Data.gov API key is required.');
  }
}

function textValue(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function isObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

function increment(target, key) {
  target[key] = (target[key] ?? 0) + 1;
}

function sortedEntries(value) {
  return Object.entries(value).sort(([left], [right]) =>
    left.localeCompare(right),
  );
}

function orderedBucketEntries(value, order) {
  return order.map((key) => [key, value[key] ?? 0]);
}

function percentileText(value) {
  return [value.p50, value.p90, value.p95, value.p99, value.max]
    .map((item) => formatNumber(item))
    .join(' / ');
}

function formatNumber(value) {
  return Number(value ?? 0).toLocaleString('en-US');
}

function formatElapsed(elapsedMs) {
  return `${(Math.max(0, elapsedMs) / 1000).toFixed(1)}s`;
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

const invokedDirectly =
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (invokedDirectly) {
  await run();
}
