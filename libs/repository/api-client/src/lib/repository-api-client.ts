import { HttpClient } from '@angular/common/http';
import { Inject, Injectable, InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import type { components } from '../generated/repository-api.types';

export const REPOSITORY_API_BASE_URL = new InjectionToken<string>(
  'REPOSITORY_API_BASE_URL',
  {
    factory: () => 'http://localhost:8080/api',
  },
);

export type SyncMode = components['schemas']['SyncMode'];
export type SyncSource = components['schemas']['SyncSource'];
export type SyncRequest = components['schemas']['SyncRequest'];
export type SyncJob = components['schemas']['SyncJob'];
export type SyncAction = components['schemas']['SyncAction'];
export type SourceInventory = components['schemas']['SourceInventory'];
export type SourceInventoryProgram =
  components['schemas']['SourceInventoryProgram'];
export type MapLayer = components['schemas']['MapLayer'];
export type CensusAreaBoundary = components['schemas']['CensusAreaBoundary'];
export type UsgsEarthquakeOverlay =
  components['schemas']['UsgsEarthquakeOverlay'];
export type UsgsEarthquakeFeature =
  components['schemas']['UsgsEarthquakeFeature'];
export type LodesFlowOverlay = components['schemas']['LodesFlowOverlay'];
export type LodesFlowSummary = components['schemas']['LodesFlowSummary'];
export type LodesWorkplaceOverlay =
  components['schemas']['LodesWorkplaceOverlay'];
export type LodesWorkplaceSummary =
  components['schemas']['LodesWorkplaceSummary'];
export type SaipeCountyChoropleth =
  components['schemas']['SaipeCountyChoropleth'];
export type SaipeCountyValue = components['schemas']['SaipeCountyValue'];
export type PopulationEstimateMeasure =
  components['schemas']['PopulationEstimateMeasure'];
export type PopulationEstimateCountyValue =
  components['schemas']['PopulationEstimateCountyValue'];
export type PopulationEstimatesChoropleth =
  components['schemas']['PopulationEstimatesChoropleth'];
export type ResearchSpatialViewport =
  components['schemas']['ResearchSpatialViewport'];
export type ResearchSpatialCoverageSummary =
  components['schemas']['ResearchSpatialCoverageSummary'];
export type ResearchSpatialCoverageFeature =
  components['schemas']['ResearchSpatialCoverageFeature'];
export type ResearchSpatialCoverageResponse =
  components['schemas']['ResearchSpatialCoverageResponse'];
export type SearchResponse = components['schemas']['SearchResponse'];
export type SearchCursorPage = components['schemas']['SearchCursorPage'];
export type SearchResult = components['schemas']['SearchResult'];
export type FacetGroup = components['schemas']['FacetGroup'];
export type FacetValue = components['schemas']['FacetValue'];
export type ResearchProgram = components['schemas']['ResearchProgram'];
export type ResearchObjectType = components['schemas']['ResearchObjectType'];
export type SourceSystem = components['schemas']['SourceSystem'];
export type AccessLevel = components['schemas']['AccessLevel'];
export type ResearchRelation = components['schemas']['ResearchRelation'];
export type ResearchAuthor = components['schemas']['ResearchAuthor'];
export type ResearchObjectDetail =
  components['schemas']['ResearchObjectDetail'];
export type DatasetFile = components['schemas']['DatasetFile'];
export type DatasetVersion = components['schemas']['DatasetVersion'];
export type DiscoveryProjectionState =
  components['schemas']['DiscoveryProjectionState'];
export type DspaceOverview = components['schemas']['DspaceOverview'];
export type SolrOverview = components['schemas']['SolrOverview'];
export type ProgramCount = components['schemas']['ProgramCount'];
export type SyncActionSummary = components['schemas']['SyncActionSummary'];
export type ProjectionBreakdown = components['schemas']['ProjectionBreakdown'];
export type AccessibilityEvidence =
  components['schemas']['AccessibilityEvidence'];
export type EvidenceStatus = components['schemas']['EvidenceStatus'];
export type SearchPerformanceEvidence =
  components['schemas']['SearchPerformanceEvidence'];
export type SearchPerformanceLatencyInference =
  components['schemas']['SearchPerformanceLatencyInference'];

export interface SearchQuery {
  readonly q?: string;
  /** Repeatable data-driven program names. Empty means every program. */
  readonly programs?: readonly string[];
  /** Exact publisher facet value, or absent for every publisher. */
  readonly publisher?: string;
  /** Controlled authoritative source system, or absent for every source. */
  readonly sourceSystem?: SourceSystem;
  readonly geography?: string;
  /** One research object type, or absent for every type. */
  readonly contentType?: ResearchObjectType;
  readonly vintageYear?: number;
  readonly page?: number;
  readonly pageSize?: number;
}

@Injectable({ providedIn: 'root' })
export class RepositoryAdminApi {
  constructor(
    private readonly http: HttpClient,
    @Inject(REPOSITORY_API_BASE_URL) private readonly baseUrl: string,
  ) {}

  startSync(request: SyncRequest): Observable<SyncJob> {
    return this.http.post<SyncJob>(`${this.baseUrl}/admin/sync`, request);
  }

  listSyncJobs(): Observable<SyncJob[]> {
    return this.http.get<SyncJob[]>(`${this.baseUrl}/admin/sync`);
  }

  getSyncJob(syncJobId: string): Observable<SyncJob> {
    return this.http.get<SyncJob>(`${this.baseUrl}/admin/sync/${syncJobId}`);
  }

  reindexDiscovery(): Observable<DiscoveryProjectionState> {
    return this.http.post<DiscoveryProjectionState>(
      `${this.baseUrl}/admin/reindex`,
      null,
    );
  }

  getDiscoveryProjectionState(): Observable<DiscoveryProjectionState> {
    return this.http.get<DiscoveryProjectionState>(
      `${this.baseUrl}/admin/reindex`,
    );
  }

  getDspaceOverview(): Observable<DspaceOverview> {
    return this.http.get<DspaceOverview>(
      `${this.baseUrl}/admin/dspace/overview`,
    );
  }

  getSolrOverview(): Observable<SolrOverview> {
    return this.http.get<SolrOverview>(`${this.baseUrl}/admin/solr/overview`);
  }

  /** How much source data the repository is subscribed to, as last measured. */
  getSourceInventory(): Observable<SourceInventory> {
    return this.http.get<SourceInventory>(
      `${this.baseUrl}/admin/sources/inventory`,
    );
  }
}

@Injectable({ providedIn: 'root' })
export class RepositoryMapsApi {
  constructor(
    private readonly http: HttpClient,
    @Inject(REPOSITORY_API_BASE_URL) private readonly baseUrl: string,
  ) {}

  getDatasetMapLayers(datasetId: string): Observable<MapLayer[]> {
    return this.http.get<MapLayer[]>(
      `${this.baseUrl}/datasets/${datasetId}/map-layers`,
    );
  }

  listCensusAreaBoundaries(): Observable<CensusAreaBoundary[]> {
    return this.http.get<CensusAreaBoundary[]>(
      `${this.baseUrl}/maps/census-areas`,
    );
  }

  getResearchSpatialCoverage(
    query: SearchQuery,
    viewport: ResearchSpatialViewport,
    limit = 200,
  ): Observable<ResearchSpatialCoverageResponse> {
    const params: Record<string, string | number | readonly string[]> = {
      sourceSystem: query.sourceSystem ?? 'DATA_GOV',
      west: viewport.west,
      south: viewport.south,
      east: viewport.east,
      north: viewport.north,
      limit,
    };

    if (query.q) {
      params['q'] = query.q;
    }
    if (query.programs?.length) {
      params['program'] = [...query.programs];
    }
    if (query.publisher) {
      params['publisher'] = query.publisher;
    }
    if (query.geography) {
      params['geography'] = query.geography;
    }
    if (query.contentType) {
      params['contentType'] = query.contentType;
    }
    if (query.vintageYear !== undefined) {
      params['vintageYear'] = query.vintageYear;
    }

    return this.http.get<ResearchSpatialCoverageResponse>(
      `${this.baseUrl}/maps/research-coverage`,
      { params },
    );
  }

  getUsgsEarthquakeOverlay(
    minMagnitude = 0,
    days = 7,
  ): Observable<UsgsEarthquakeOverlay> {
    return this.http.get<UsgsEarthquakeOverlay>(
      `${this.baseUrl}/overlays/usgs/earthquakes`,
      {
        params: {
          minMagnitude,
          days,
        },
      },
    );
  }

  getLodesWorkplaceOverlay(
    geography: string,
  ): Observable<LodesWorkplaceOverlay> {
    return this.http.get<LodesWorkplaceOverlay>(
      `${this.baseUrl}/overlays/census/lodes-workplace`,
      { params: { geography } },
    );
  }

  getLodesFlowOverlay(geography: string): Observable<LodesFlowOverlay> {
    return this.http.get<LodesFlowOverlay>(
      `${this.baseUrl}/overlays/census/lodes-flow`,
      {
        params: { geography },
      },
    );
  }

  getPopulationEstimatesChoropleth(
    geography: string,
    measure: PopulationEstimateMeasure = 'ANNUAL_GROWTH_RATE',
    year = 2025,
  ): Observable<PopulationEstimatesChoropleth> {
    return this.http.get<PopulationEstimatesChoropleth>(
      `${this.baseUrl}/overlays/census/population-estimates`,
      {
        params: {
          geography,
          measure,
          year,
        },
      },
    );
  }

  getSaipeCountyChoropleth(
    geography: string,
  ): Observable<SaipeCountyChoropleth> {
    return this.http.get<SaipeCountyChoropleth>(
      `${this.baseUrl}/overlays/census/saipe-counties`,
      {
        params: { geography },
      },
    );
  }
}

@Injectable({ providedIn: 'root' })
export class RepositoryDatasetsApi {
  constructor(
    private readonly http: HttpClient,
    @Inject(REPOSITORY_API_BASE_URL) private readonly baseUrl: string,
  ) {}

  getResearchObject(researchId: string): Observable<ResearchObjectDetail> {
    return this.http.get<ResearchObjectDetail>(
      `${this.baseUrl}/research/${researchId}`,
    );
  }

  getDataset(datasetId: string): Observable<ResearchObjectDetail> {
    return this.http.get<ResearchObjectDetail>(
      `${this.baseUrl}/datasets/${datasetId}`,
    );
  }

  getDatasetVersions(datasetId: string): Observable<DatasetVersion[]> {
    return this.http.get<DatasetVersion[]>(
      `${this.baseUrl}/datasets/${datasetId}/versions`,
    );
  }
}

@Injectable({ providedIn: 'root' })
export class RepositoryEvidenceApi {
  constructor(
    private readonly http: HttpClient,
    @Inject(REPOSITORY_API_BASE_URL) private readonly baseUrl: string,
  ) {}

  listAccessibilityEvidence(): Observable<AccessibilityEvidence[]> {
    return this.http.get<AccessibilityEvidence[]>(
      `${this.baseUrl}/accessibility/evidence`,
    );
  }

  getSearchPerformanceEvidence(): Observable<SearchPerformanceEvidence> {
    return this.http.get<SearchPerformanceEvidence>(
      `${this.baseUrl}/evidence/search-performance`,
    );
  }
}

@Injectable({ providedIn: 'root' })
export class RepositorySearchApi {
  constructor(
    private readonly http: HttpClient,
    @Inject(REPOSITORY_API_BASE_URL) private readonly baseUrl: string,
  ) {}

  searchResearchObjects(query: SearchQuery): Observable<SearchResponse> {
    return this.http.get<SearchResponse>(`${this.baseUrl}/search`, {
      params: this.searchParams(query, true),
    });
  }

  searchResearchObjectsWithCursor(
    query: SearchQuery,
    cursor: string | null = null,
  ): Observable<SearchCursorPage> {
    const params = this.searchParams(query, false);
    if (cursor) {
      params['cursor'] = cursor;
    }

    return this.http.get<SearchCursorPage>(`${this.baseUrl}/search/cursor`, {
      params,
    });
  }

  private searchParams(
    query: SearchQuery,
    includePage: boolean,
  ): Record<string, string | number | readonly string[]> {
    const params: Record<string, string | number | readonly string[]> = {};

    if (query.q) {
      params['q'] = query.q;
    }

    if (query.programs?.length) {
      // HttpParams keeps repeated keys, which is how the contract expresses "any of these".
      params['program'] = [...query.programs];
    }

    if (query.publisher) {
      params['publisher'] = query.publisher;
    }

    if (query.sourceSystem) {
      params['sourceSystem'] = query.sourceSystem;
    }

    if (query.geography) {
      params['geography'] = query.geography;
    }

    if (query.contentType) {
      params['contentType'] = query.contentType;
    }

    if (query.vintageYear !== undefined) {
      params['vintageYear'] = query.vintageYear;
    }

    if (includePage && query.page !== undefined) {
      params['page'] = query.page;
    }

    if (query.pageSize !== undefined) {
      params['pageSize'] = query.pageSize;
    }

    return params;
  }
}
