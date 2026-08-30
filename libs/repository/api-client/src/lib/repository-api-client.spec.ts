import { firstValueFrom, of } from 'rxjs';
import {
  RepositoryAdminApi,
  RepositoryDatasetsApi,
  RepositoryEvidenceApi,
  RepositoryMapsApi,
  RepositorySearchApi,
  type ResearchObjectDetail,
  type DatasetVersion,
  type MapLayer,
  type SearchResponse,
  type SyncJob,
  type UsgsEarthquakeOverlay,
} from './repository-api-client';

describe('RepositoryAdminApi', () => {
  it('starts a typed sync job and lists history', async () => {
    const job: SyncJob = {
      id: '92e0cc30-1f7f-49dd-babf-c3d13ce66b46',
      mode: 'DRY_RUN',
      source: 'TIGER_LINE',
      status: 'DRY_RUN_COMPLETE',
      startedAt: '2026-08-11T19:00:00Z',
      actions: [],
    };
    const http = {
      post: vi.fn(() => of(job)),
      get: vi.fn(() => of([job])),
    };
    const api = new RepositoryAdminApi(http as never, 'http://api.test/api');

    api
      .startSync({ mode: 'DRY_RUN', source: 'TIGER_LINE' })
      .subscribe((sync) => {
        expect(sync).toBe(job);
      });

    expect(http.post).toHaveBeenCalledWith('http://api.test/api/admin/sync', {
      mode: 'DRY_RUN',
      source: 'TIGER_LINE',
    });

    await expect(firstValueFrom(api.listSyncJobs())).resolves.toEqual([job]);
    expect(http.get).toHaveBeenCalledWith('http://api.test/api/admin/sync');
  });

  it('loads DSpace and Solr admin overviews', async () => {
    const dspaceOverview = {
      reachable: true,
      readEnabled: true,
      writeEnabled: false,
      itemCount: 2,
    };
    const solrOverview = {
      enabled: true,
      reachable: true,
      core: 'discovery',
      indexedDocumentCount: 2,
    };
    const http = {
      get: vi.fn((url: string) =>
        of(url.includes('/solr/') ? solrOverview : dspaceOverview),
      ),
    };
    const api = new RepositoryAdminApi(http as never, 'http://api.test/api');

    await expect(firstValueFrom(api.getDspaceOverview())).resolves.toEqual(
      dspaceOverview,
    );
    await expect(firstValueFrom(api.getSolrOverview())).resolves.toEqual(
      solrOverview,
    );
  });
});

describe('RepositoryDatasetsApi', () => {
  it('loads authority-neutral research detail plus legacy dataset detail and versions', async () => {
    const detail: ResearchObjectDetail = {
      id: 'tiger-line-north-dakota-2025',
      title: '2025 TIGER/Line - Census Tracts - North Dakota',
      program: 'TIGER_LINE',
      publisher: 'U.S. Census Bureau',
      abstractText: 'Boundary metadata.',
      geography: 'North Dakota',
      vintageYear: 2025,
      releasedOn: '2025-08-01',
      files: [],
      citation: 'U.S. Census Bureau. TIGER/Line.',
      sourceUrl: 'https://example.test/tiger',
      accessibilityEvidenceStatus: 'AUTOMATED_PASS',
      relatedResearch: [],
    };
    const versions: DatasetVersion[] = [
      {
        id: 'tiger-line-north-dakota-2025-current',
        label: '2025 TIGER/Line - Census Tracts - North Dakota',
        releasedOn: '2025-08-01',
        current: true,
      },
    ];
    const http = {
      get: vi.fn((url: string) =>
        of(url.endsWith('/versions') ? versions : detail),
      ),
    };
    const api = new RepositoryDatasetsApi(http as never, 'http://api.test/api');
    const researchId = 'REFUQV9HT1Y6aHR0cHM6Ly9leGFtcGxlLmdvdg';

    await expect(
      firstValueFrom(api.getResearchObject(researchId)),
    ).resolves.toEqual(detail);
    expect(http.get).toHaveBeenCalledWith(
      `http://api.test/api/research/${researchId}`,
    );

    await expect(
      firstValueFrom(api.getDataset('tiger-line-north-dakota-2025')),
    ).resolves.toEqual(detail);
    expect(http.get).toHaveBeenCalledWith(
      'http://api.test/api/datasets/tiger-line-north-dakota-2025',
    );

    await expect(
      firstValueFrom(api.getDatasetVersions('tiger-line-north-dakota-2025')),
    ).resolves.toEqual(versions);
    expect(http.get).toHaveBeenCalledWith(
      'http://api.test/api/datasets/tiger-line-north-dakota-2025/versions',
    );
  });
});

describe('RepositoryEvidenceApi', () => {
  it('loads accessibility evidence summaries', async () => {
    const entries = [
      {
        id: 'axe-wcag-2026-08-12',
        workflow: 'axe-core scans (6 routes)',
        status: 'AUTOMATED_PASS' as const,
        standard: 'WCAG_2_1_AA' as const,
        capturedAt: '2026-08-12T00:00:00Z',
      },
    ];
    const http = {
      get: vi.fn(() => of(entries)),
    };
    const api = new RepositoryEvidenceApi(http as never, 'http://api.test/api');

    await expect(
      firstValueFrom(api.listAccessibilityEvidence()),
    ).resolves.toEqual(entries);
    expect(http.get).toHaveBeenCalledWith(
      'http://api.test/api/accessibility/evidence',
    );
  });
});

describe('RepositorySearchApi', () => {
  it('loads typed search results with data-driven authority filters', async () => {
    const response: SearchResponse = {
      query: 'North Dakota',
      page: 0,
      pageSize: 25,
      totalResults: 1,
      results: [
        {
          id: 'tiger-line-nd-2025',
          title: '2025 TIGER/Line - Census Tracts - North Dakota',
          contentType: 'DATASET',
          program: 'TIGER_LINE',
          publisher: 'U.S. Census Bureau',
          summary: 'Boundary metadata.',
          geography: 'North Dakota',
          vintageYear: 2025,
          sourceUrl: 'https://example.test/tiger',
        },
      ],
      facets: [],
    };
    const http = {
      get: vi.fn(() => of(response)),
    };
    const api = new RepositorySearchApi(http as never, 'http://api.test/api');

    await expect(
      firstValueFrom(
        api.searchResearchObjects({
          q: 'North Dakota',
          programs: ['TIGER_LINE', 'Office of Science'],
          publisher: 'U.S. Census Bureau',
          sourceSystem: 'CENSUS',
          page: 0,
          pageSize: 25,
        }),
      ),
    ).resolves.toEqual(response);

    // Repeated program keys and response-driven publisher/source values pass through unchanged.
    expect(http.get).toHaveBeenCalledWith('http://api.test/api/search', {
      params: {
        q: 'North Dakota',
        program: ['TIGER_LINE', 'Office of Science'],
        publisher: 'U.S. Census Bureau',
        sourceSystem: 'CENSUS',
        page: 0,
        pageSize: 25,
      },
    });
  });
});

describe('RepositoryMapsApi', () => {
  it('loads typed map layers and USGS overlays', async () => {
    const layer: MapLayer = {
      id: 'tiger-line-nd-boundary',
      label: '2025 TIGER/Line - Census Tracts - North Dakota',
      layerType: 'CENSUS_BOUNDARY',
      sourceUrl: 'https://example.test/tiger',
      attribution: 'U.S. Census Bureau TIGER/Line',
      visibleByDefault: true,
    };
    const overlay: UsgsEarthquakeOverlay = {
      source: 'USGS Earthquake Catalog GeoJSON',
      sourceUrl:
        'https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson',
      attribution: 'U.S. Geological Survey Earthquake Hazards Program',
      updatedAt: '2026-08-11T19:00:00Z',
      staleAfter: '2026-08-12T19:00:00Z',
      fallback: false,
      query: {
        minMagnitude: 1,
        days: 14,
        minLatitude: 45.8,
        maxLatitude: 49.1,
        minLongitude: -104.2,
        maxLongitude: -96.4,
      },
      features: [],
    };
    const http = {
      get: vi.fn((url: string) =>
        of(url.includes('/overlays/') ? overlay : [layer]),
      ),
    };
    const api = new RepositoryMapsApi(http as never, 'http://api.test/api');

    await expect(
      firstValueFrom(api.getDatasetMapLayers('tiger-line-nd')),
    ).resolves.toEqual([layer]);
    expect(http.get).toHaveBeenCalledWith(
      'http://api.test/api/datasets/tiger-line-nd/map-layers',
    );

    await expect(
      firstValueFrom(api.getUsgsEarthquakeOverlay(1, 14)),
    ).resolves.toEqual(overlay);
    expect(http.get).toHaveBeenCalledWith(
      'http://api.test/api/overlays/usgs/earthquakes',
      {
        params: {
          minMagnitude: 1,
          days: 14,
        },
      },
    );
  });
});
