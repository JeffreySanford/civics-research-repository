import assert from 'node:assert/strict';
import test from 'node:test';
import './search-comparison-c2-evidence.test.mjs';
import './search-comparison-statistical-report.test.mjs';
import { summarizePairedLatencyEvidence } from './search-comparison-statistics.mjs';

test('paired latency evidence reports a deterministic bootstrap interval', () => {
  const result = summarizePairedLatencyEvidence(
    [10, 20, 30, 40, 50],
    [20, 30, 40, 50, 60],
    { bootstrapIterations: 1000, seed: 42 },
  );

  assert.equal(result.sampleCount, 5);
  assert.equal(result.medianDifferenceMs, 10);
  assert.equal(result.solrWinRatePercent, 100);
  assert.equal(result.tieRatePercent, 0);
  assert.equal(result.bootstrap.lowerMs, 10);
  assert.equal(result.bootstrap.upperMs, 10);
  assert.equal(result.bootstrap.excludesZero, true);
});

test('paired latency evidence keeps mixed outcomes visible', () => {
  const result = summarizePairedLatencyEvidence(
    [10, 20, 40, 50],
    [20, 20, 30, 70],
    { bootstrapIterations: 1000, seed: 7 },
  );

  assert.equal(result.sampleCount, 4);
  assert.equal(result.solrWinRatePercent, 50);
  assert.equal(result.tieRatePercent, 25);
  assert.equal(
    result.interpretation,
    'Positive differences mean OpenSearch took longer than Solr.',
  );
});

test('paired latency evidence rejects unpaired samples', () => {
  assert.throws(
    () => summarizePairedLatencyEvidence([10, 20], [11]),
    /same non-zero length/,
  );
});
