import {
  nearestRankPercentile,
  summarizeTimingSamples,
} from './search-comparison-benchmark.mjs';

export const C2_1_FULL_TEXT_QUERIES = Object.freeze([
  Object.freeze({ id: 'Q01', class: 'single/common', query: 'energy' }),
  Object.freeze({ id: 'Q02', class: 'single/common', query: 'data' }),
  Object.freeze({ id: 'Q03', class: 'single/domain', query: 'workforce' }),
  Object.freeze({ id: 'Q04', class: 'single/domain', query: 'climate' }),
  Object.freeze({ id: 'Q05', class: 'single/domain', query: 'water' }),
  Object.freeze({ id: 'Q06', class: 'two-term', query: 'North Dakota' }),
  Object.freeze({ id: 'Q07', class: 'two-term', query: 'renewable energy' }),
  Object.freeze({ id: 'Q08', class: 'two-term', query: 'labor force' }),
  Object.freeze({
    id: 'Q09',
    class: 'two-term',
    query: 'population estimates',
  }),
  Object.freeze({
    id: 'Q10',
    class: 'two-term',
    query: 'energy efficiency',
  }),
  Object.freeze({
    id: 'Q11',
    class: 'three-plus',
    query: 'North Dakota workforce',
  }),
  Object.freeze({
    id: 'Q12',
    class: 'three-plus',
    query: 'groundwater quality research',
  }),
  Object.freeze({
    id: 'Q13',
    class: 'three-plus',
    query: 'renewable energy technology',
  }),
  Object.freeze({
    id: 'Q14',
    class: 'three-plus',
    query: 'economic development data',
  }),
  Object.freeze({
    id: 'Q15',
    class: 'three-plus',
    query: 'carbon emissions research',
  }),
  Object.freeze({
    id: 'Q16',
    class: 'federal/source vocabulary',
    query: 'Department of Energy',
  }),
  Object.freeze({
    id: 'Q17',
    class: 'federal/source vocabulary',
    query: 'Census Bureau geography',
  }),
  Object.freeze({
    id: 'Q18',
    class: 'cross-domain',
    query: 'scientific research data',
  }),
  Object.freeze({
    id: 'Q19',
    class: 'high-result candidate',
    query: 'United States',
  }),
  Object.freeze({
    id: 'Q20',
    class: 'no-result control',
    query: 'zzzxqv_nonexistent_research_term_20260903',
  }),
]);

export const C2_1_SELECTIVITY_BANDS = Object.freeze([
  Object.freeze({
    id: 'BROAD',
    minimumPercent: 25,
    maximumPercent: 75,
    targetPercent: 50,
  }),
  Object.freeze({
    id: 'MODERATE',
    minimumPercent: 5,
    maximumPercent: 25,
    targetPercent: 15,
  }),
  Object.freeze({
    id: 'SELECTIVE',
    minimumPercent: 0.5,
    maximumPercent: 5,
    targetPercent: 2,
  }),
]);

export const DEFAULT_C2_1_FILTER_FIELDS = Object.freeze([
  'program',
  'publisher',
  'sourceSystem',
]);

function requirePositiveDocumentCount(value) {
  const count = Number(value);
  if (!Number.isFinite(count) || count <= 0) {
    throw new Error(
      'C2.1 filter selection requires a positive projection object count.',
    );
  }
  return count;
}

function requireParityResponse(response) {
  if (!response?.sameProjection) {
    throw new Error(
      'C2.1 filter selection requires Solr/OpenSearch projection parity.',
    );
  }
  if (!response?.solr?.reachable || !response?.openSearch?.reachable) {
    throw new Error(
      'C2.1 filter selection requires both engines to be reachable.',
    );
  }
  return requirePositiveDocumentCount(response?.projection?.objectCount);
}

function facetGroup(engine, field) {
  const group = engine?.facets?.find((facet) => facet.field === field);
  return group && Array.isArray(group.values) ? group : null;
}

function facetCountMap(group) {
  if (!group) {
    return new Map();
  }
  return new Map(
    group.values.map((value) => [String(value.value), Number(value.count)]),
  );
}

function normalizedIdentity(field, value) {
  return `${field}=${String(value).trim()}`;
}

export function collectC21ParityFilterCandidates(
  response,
  { fields = DEFAULT_C2_1_FILTER_FIELDS } = {},
) {
  const totalDocuments = requireParityResponse(response);
  if (!Array.isArray(fields) || fields.length === 0) {
    throw new Error('At least one C2.1 candidate facet field is required.');
  }

  const candidates = [];
  for (const field of fields) {
    const solrGroup = facetGroup(response.solr, field);
    const openSearchGroup = facetGroup(response.openSearch, field);
    if (!solrGroup || !openSearchGroup) {
      continue;
    }
    const openSearchCounts = facetCountMap(openSearchGroup);
    for (const value of solrGroup.values) {
      const normalizedValue = String(value?.value ?? '').trim();
      const count = Number(value?.count);
      const openSearchCount = openSearchCounts.get(String(value?.value));
      if (
        normalizedValue === '' ||
        !Number.isFinite(count) ||
        count < 0 ||
        !Number.isFinite(openSearchCount) ||
        openSearchCount !== count
      ) {
        continue;
      }
      candidates.push({
        field,
        value: normalizedValue,
        count,
        selectivityPercent: (count / totalDocuments) * 100,
        normalizedIdentity: normalizedIdentity(field, normalizedValue),
      });
    }
  }

  return candidates.sort((left, right) =>
    left.normalizedIdentity.localeCompare(right.normalizedIdentity),
  );
}

function chooseBandCandidate(candidates, band) {
  const eligible = candidates
    .filter(
      (candidate) =>
        candidate.selectivityPercent >= band.minimumPercent &&
        candidate.selectivityPercent <= band.maximumPercent,
    )
    .map((candidate) => ({
      ...candidate,
      targetDistancePercent: Math.abs(
        candidate.selectivityPercent - band.targetPercent,
      ),
    }))
    .sort(
      (left, right) =>
        left.targetDistancePercent - right.targetDistancePercent ||
        left.normalizedIdentity.localeCompare(right.normalizedIdentity),
    );

  if (eligible.length === 0) {
    return {
      band: band.id,
      status: 'NO_VALID_CANDIDATE',
      targetPercent: band.targetPercent,
      minimumPercent: band.minimumPercent,
      maximumPercent: band.maximumPercent,
      selected: null,
      eligibleCandidates: [],
    };
  }

  return {
    band: band.id,
    status: 'SELECTED',
    targetPercent: band.targetPercent,
    minimumPercent: band.minimumPercent,
    maximumPercent: band.maximumPercent,
    selected: eligible[0],
    eligibleCandidates: eligible,
  };
}

export function selectC21FilterBands(
  response,
  {
    fields = DEFAULT_C2_1_FILTER_FIELDS,
    bands = C2_1_SELECTIVITY_BANDS,
  } = {},
) {
  const totalDocuments = requireParityResponse(response);
  const candidates = collectC21ParityFilterCandidates(response, { fields });
  return {
    totalDocuments,
    candidateFields: [...fields],
    candidates,
    bands: bands.map((band) => chooseBandCandidate(candidates, band)),
  };
}

export function summarizeC21TimingSamples(values) {
  const baseline = summarizeTimingSamples(values);
  return {
    sampleCount: baseline.sampleCount,
    minMs: baseline.minMs,
    p50Ms: baseline.p50Ms,
    p90Ms: nearestRankPercentile(values, 0.9),
    p95Ms: baseline.p95Ms,
    p99Ms: baseline.p99Ms,
    maxMs: baseline.maxMs,
    meanMs: baseline.meanMs,
  };
}
