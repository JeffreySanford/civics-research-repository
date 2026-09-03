function requireFiniteNonNegative(value, label) {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${label} must be a finite, non-negative number.`);
  }
  return value;
}

function requireInteger(value, label, minimum) {
  if (!Number.isInteger(value) || value < minimum) {
    throw new Error(
      `${label} must be an integer greater than or equal to ${minimum}.`,
    );
  }
  return value;
}

function nearestRank(values, percentile) {
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.max(1, Math.ceil(percentile * sorted.length));
  return sorted[rank - 1];
}

function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function pairedDifferences(solrSamples, openSearchSamples) {
  if (!Array.isArray(solrSamples) || !Array.isArray(openSearchSamples)) {
    throw new Error('Solr and OpenSearch samples must both be arrays.');
  }
  if (
    solrSamples.length === 0 ||
    solrSamples.length !== openSearchSamples.length
  ) {
    throw new Error(
      'Solr and OpenSearch samples must have the same non-zero length.',
    );
  }

  return solrSamples.map((solrValue, index) => {
    const solrMs = requireFiniteNonNegative(solrValue, 'Solr sample');
    const openSearchMs = requireFiniteNonNegative(
      openSearchSamples[index],
      'OpenSearch sample',
    );
    return {
      differenceMs: openSearchMs - solrMs,
      relativeDifferencePercent:
        openSearchMs === 0
          ? null
          : ((openSearchMs - solrMs) / openSearchMs) * 100,
    };
  });
}

export function summarizePairedLatencyEvidence(
  solrSamples,
  openSearchSamples,
  { bootstrapIterations = 5000, confidenceLevel = 0.95, seed = 20260903 } = {},
) {
  requireInteger(bootstrapIterations, 'bootstrapIterations', 100);
  requireInteger(seed, 'seed', 0);
  if (!(confidenceLevel > 0 && confidenceLevel < 1)) {
    throw new Error('confidenceLevel must be greater than 0 and less than 1.');
  }

  const pairs = pairedDifferences(solrSamples, openSearchSamples);
  const differences = pairs.map((pair) => pair.differenceMs);
  const relativeDifferences = pairs
    .map((pair) => pair.relativeDifferencePercent)
    .filter((value) => value !== null);
  const random = seededRandom(seed);
  const bootstrapMedians = [];

  for (let iteration = 0; iteration < bootstrapIterations; iteration += 1) {
    const resampledDifferences = [];
    for (let index = 0; index < differences.length; index += 1) {
      const selectedIndex = Math.floor(random() * differences.length);
      resampledDifferences.push(differences[selectedIndex]);
    }
    bootstrapMedians.push(nearestRank(resampledDifferences, 0.5));
  }

  const alpha = 1 - confidenceLevel;
  const lowerMs = nearestRank(bootstrapMedians, alpha / 2);
  const upperMs = nearestRank(bootstrapMedians, 1 - alpha / 2);
  const solrWins = differences.filter((difference) => difference > 0).length;
  const ties = differences.filter((difference) => difference === 0).length;

  return {
    sampleCount: differences.length,
    interpretation: 'Positive differences mean OpenSearch took longer than Solr.',
    medianDifferenceMs: nearestRank(differences, 0.5),
    medianRelativeDifferencePercent:
      relativeDifferences.length === 0
        ? null
        : Math.round(nearestRank(relativeDifferences, 0.5) * 100) / 100,
    solrWinRatePercent:
      Math.round((solrWins / differences.length) * 10000) / 100,
    tieRatePercent: Math.round((ties / differences.length) * 10000) / 100,
    bootstrap: {
      method: 'paired percentile bootstrap of median latency difference',
      seed,
      iterations: bootstrapIterations,
      confidenceLevel,
      lowerMs,
      upperMs,
      excludesZero: lowerMs > 0 || upperMs < 0,
    },
  };
}
