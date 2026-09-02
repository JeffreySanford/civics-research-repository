import type {
  CensusAreaBoundary,
  SearchQuery,
  SearchResponse,
} from 'repository-api-client';

export interface ResearchCoverageAreaSummary {
  readonly id: string;
  readonly geography: string;
  readonly count: number;
  readonly centerLatitude: number;
  readonly centerLongitude: number;
}

export interface ResearchCoverageSummary {
  readonly query: SearchQuery;
  readonly resultSource: SearchResponse['resultSource'];
  readonly totalResults: number;
  readonly mappedResults: number;
  readonly unmappedResults: number;
  readonly areas: readonly ResearchCoverageAreaSummary[];
}

/**
 * Turns the existing bounded geography facet into a map-ready state summary.
 *
 * Search already aggregates the full active projection in Solr/OpenSearch, so this intentionally
 * does not walk result pages in the browser. The only records represented here are those whose
 * normalized research metadata explicitly names one of the Census areas the application knows.
 * Publisher/institution locations never enter this join.
 *
 * The geography facet is self-excluding so Discovery can show alternative geography choices while
 * one is selected. When a map was opened from a geography-filtered search, keep only that selected
 * facet value; otherwise the summary would misleadingly draw areas outside the effective search.
 */
export function buildResearchCoverageSummary(
  response: SearchResponse,
  boundaries: readonly CensusAreaBoundary[],
  query: SearchQuery,
): ResearchCoverageSummary {
  const geographyFacet = response.facets.find(
    (facet) => facet.field === 'geography',
  );
  const selectedGeography = normalize(query.geography);
  const boundaryByGeography = new Map(
    boundaries.map((boundary) => [normalize(boundary.geography), boundary]),
  );

  const areas = (geographyFacet?.values ?? [])
    .filter((value) => value.count > 0)
    .filter(
      (value) =>
        !selectedGeography || normalize(value.value) === selectedGeography,
    )
    .flatMap((value): ResearchCoverageAreaSummary[] => {
      const boundary = boundaryByGeography.get(normalize(value.value));
      if (!boundary) {
        return [];
      }
      return [
        {
          id: boundary.id,
          geography: boundary.geography,
          count: value.count,
          centerLatitude: boundary.centerLatitude,
          centerLongitude: boundary.centerLongitude,
        },
      ];
    })
    .sort(
      (left, right) =>
        right.count - left.count || left.geography.localeCompare(right.geography),
    );

  const mappedResults = areas.reduce((total, area) => total + area.count, 0);

  return {
    query,
    resultSource: response.resultSource,
    totalResults: response.totalResults,
    mappedResults,
    unmappedResults: Math.max(0, response.totalResults - mappedResults),
    areas,
  };
}

function normalize(value: string | undefined): string {
  return value?.trim().toLocaleLowerCase() ?? '';
}
