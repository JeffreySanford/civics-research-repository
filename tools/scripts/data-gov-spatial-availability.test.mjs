import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildProbeSql,
  formatMarkdown,
  normalizeProbe,
  parseArgs,
  parsePsqlJson,
} from './data-gov-spatial-availability.mjs';

test('probe SQL is read-only and scopes the retained Data.gov corpus', () => {
  const sql = buildProbeSql();

  assert.match(sql, /from federated_research_objects/u);
  assert.match(sql, /source_system = 'DATA_GOV'/u);
  assert.match(sql, /harvestRecordRaw/u);
  assert.match(sql, /"spatial"/u);
  assert.doesNotMatch(sql, /\b(update|delete|insert|truncate)\b/iu);
});

test('normalizes counts and makes the unmapped/raw gap explicit', () => {
  const report = normalizeProbe(
    {
      totalRecords: 500000,
      harvestRecordPresent: 499900,
      harvestRecordRawPresent: 499000,
      explicitSpatialTokenRecords: 125000,
      spatialTextRecords: 100000,
      spatialObjectRecords: 20000,
      spatialArrayRecords: 4000,
    },
    '2026-09-02T16:00:00.000Z',
  );

  assert.equal(report.totalRecords, 500000);
  assert.equal(report.rawHarvestUnavailable, 1000);
  assert.equal(report.explicitSpatialTokenRecords, 125000);
  assert.equal(report.explicitSpatialTokenPercent, 25);
  assert.deepEqual(report.spatialRepresentations, {
    text: 100000,
    object: 20000,
    array: 4000,
    other: 1000,
  });
});

test('rejects impossible spatial counts', () => {
  assert.throws(
    () =>
      normalizeProbe({
        totalRecords: 10,
        harvestRecordPresent: 10,
        harvestRecordRawPresent: 5,
        explicitSpatialTokenRecords: 6,
        spatialTextRecords: 6,
        spatialObjectRecords: 0,
        spatialArrayRecords: 0,
      }),
    /cannot exceed/u,
  );
});

test('parses quiet psql output by taking the final nonblank JSON line', () => {
  assert.deepEqual(parsePsqlJson('\nNOTICE\n{"totalRecords":12}\n'), {
    totalRecords: 12,
  });
});

test('markdown distinguishes token availability from validated geometry', () => {
  const report = normalizeProbe(
    {
      totalRecords: 10,
      harvestRecordPresent: 10,
      harvestRecordRawPresent: 10,
      explicitSpatialTokenRecords: 4,
      spatialTextRecords: 3,
      spatialObjectRecords: 1,
      spatialArrayRecords: 0,
    },
    '2026-09-02T16:00:00.000Z',
  );
  const markdown = formatMarkdown(report, 10);

  assert.match(markdown, /Explicit `spatial` token present/u);
  assert.match(markdown, /not proof that the value is valid geometry/u);
  assert.match(markdown, /\(MATCH\)/u);
});

test('argument parser supports an exact C2 expectation and output directory', () => {
  assert.deepEqual(
    parseArgs(['--expect', '500000', '--output-dir', 'tmp/spatial']),
    { expectedCount: 500000, outputDir: 'tmp/spatial' },
  );
});
