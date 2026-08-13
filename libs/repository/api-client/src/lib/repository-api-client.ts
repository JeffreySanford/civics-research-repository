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
export type MapLayer = components['schemas']['MapLayer'];
export type CensusAreaBoundary = components['schemas']['CensusAreaBoundary'];
export type UsgsEarthquakeOverlay =
  components['schemas']['UsgsEarthquakeOverlay'];
export type UsgsEarthquakeFeature =
  components['schemas']['UsgsEarthquakeFeature'];
export type LodesFlowOverlay = components['schemas']['LodesFlowOverlay'];
export type LodesFlowSummary = components['schemas']['LodesFlowSummary'];
export type SaipeCountyChoropleth =
  components['schemas']['SaipeCountyChoropleth'];
export type SaipeCountyValue = components['schemas']['SaipeCountyValue'];
export type SearchResponse = components['schemas']['SearchResponse'];
export type SearchResult = components['schemas']['SearchResult'];
export type FacetGroup = components['schemas']['FacetGroup'];
export type FacetValue = components['schemas']['FacetValue'];
export type ResearchProgram = components['schemas']['ResearchProgram'];
export type DatasetDetail = components['schemas']['DatasetDetail'];
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

export interface SearchQuery {
  readonly q?: string;
  /** Repeatable. Results match any selected program; empty means every program. */
  readonly programs?: readonly ResearchProgram[];
  readonly geography?: string;
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

  getLodesFlowOverlay(geography: string): Observable<LodesFlowOverlay> {
    return this.http.get<LodesFlowOverlay>(
      `${this.baseUrl}/overlays/census/lodes-flow`,
      {
        params: { geography },
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

  getDataset(datasetId: string): Observable<DatasetDetail> {
    return this.http.get<DatasetDetail>(
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
}

@Injectable({ providedIn: 'root' })
export class RepositorySearchApi {
  constructor(
    private readonly http: HttpClient,
    @Inject(REPOSITORY_API_BASE_URL) private readonly baseUrl: string,
  ) {}

  searchResearchObjects(query: SearchQuery): Observable<SearchResponse> {
    const params: Record<string, string | number | readonly string[]> = {};

    if (query.q) {
      params['q'] = query.q;
    }

    if (query.programs?.length) {
      // HttpParams keeps repeated keys, which is how the contract expresses "any of these".
      params['program'] = [...query.programs];
    }

    if (query.geography) {
      params['geography'] = query.geography;
    }

    if (query.vintageYear !== undefined) {
      params['vintageYear'] = query.vintageYear;
    }

    if (query.page !== undefined) {
      params['page'] = query.page;
    }

    if (query.pageSize !== undefined) {
      params['pageSize'] = query.pageSize;
    }

    return this.http.get<SearchResponse>(`${this.baseUrl}/search`, {
      params,
    });
  }
}
