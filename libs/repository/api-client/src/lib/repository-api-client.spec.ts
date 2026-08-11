import { firstValueFrom, of } from 'rxjs';
import {
  RepositoryAdminApi,
  RepositoryMapsApi,
  RepositorySearchApi,
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
});

describe('RepositorySearchApi', () => {
  it('loads typed search results with query parameters', async () => {
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
          program: 'TIGER_LINE',
          page: 0,
          pageSize: 25,
        }),
      ),
    ).resolves.toEqual(response);

    expect(http.get).toHaveBeenCalledWith('http://api.test/api/search', {
      params: {
        q: 'North Dakota',
        program: 'TIGER_LINE',
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
      updatedAt: '2026-08-11T19:00:00Z',
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
