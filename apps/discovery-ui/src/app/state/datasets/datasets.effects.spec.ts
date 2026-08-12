import { TestBed } from '@angular/core/testing';
import { provideMockActions } from '@ngrx/effects/testing';
import { firstValueFrom, of, throwError, type Observable } from 'rxjs';
import {
  RepositoryDatasetsApi,
  RepositoryMapsApi,
  type DatasetDetail,
  type DatasetVersion,
  type MapLayer,
} from 'repository-api-client';
import { DatasetsActions } from './datasets.actions';
import { DatasetsEffects } from './datasets.effects';

const detail = {
  id: 'tiger-line-north-dakota-2025',
  title: '2025 TIGER/Line - Census Tracts - North Dakota',
  program: 'TIGER_LINE',
  publisher: 'U.S. Census Bureau',
  abstractText: 'Tract geometry metadata.',
  geography: 'North Dakota',
  vintageYear: 2025,
  releasedOn: '2025-08-01',
  files: [],
  citation: 'U.S. Census Bureau. 2025 TIGER/Line Shapefiles.',
  sourceUrl: 'https://www2.census.gov/geo/tiger/TIGER2025/',
  accessibilityEvidenceStatus: 'AUTOMATED_PASS',
  relatedResearch: [],
} as unknown as DatasetDetail;

const versions: DatasetVersion[] = [
  {
    id: 'tiger-line-north-dakota-2025-current',
    label: 'Current',
    releasedOn: '2025-08-01',
    current: true,
  },
];

const mapLayers = [
  {
    id: 'tiger-boundary',
    label: 'North Dakota TIGER/Line preview',
    layerType: 'CENSUS_BOUNDARY',
    sourceUrl: 'https://www2.census.gov/geo/tiger/TIGER2025/',
    attribution: 'U.S. Census Bureau TIGER/Line',
    visibleByDefault: true,
  },
] as unknown as MapLayer[];

function setup(
  datasetsApi: Partial<RepositoryDatasetsApi>,
  mapsApi: Partial<RepositoryMapsApi>,
  actions$: Observable<unknown>,
) {
  TestBed.configureTestingModule({
    providers: [
      DatasetsEffects,
      provideMockActions(() => actions$),
      { provide: RepositoryDatasetsApi, useValue: datasetsApi },
      { provide: RepositoryMapsApi, useValue: mapsApi },
    ],
  });

  return TestBed.inject(DatasetsEffects);
}

describe('DatasetsEffects', () => {
  it('loads detail, versions, and map layers together for one dataset', async () => {
    const getDataset = vi.fn().mockReturnValue(of(detail));
    const getDatasetVersions = vi.fn().mockReturnValue(of(versions));
    const getDatasetMapLayers = vi.fn().mockReturnValue(of(mapLayers));
    const effects = setup(
      { getDataset, getDatasetVersions } as unknown as RepositoryDatasetsApi,
      { getDatasetMapLayers } as unknown as RepositoryMapsApi,
      of(
        DatasetsActions.datasetOpened({
          datasetId: 'tiger-line-north-dakota-2025',
        }),
      ),
    );

    const emitted = await firstValueFrom(effects.openDataset$);

    expect(getDataset).toHaveBeenCalledWith('tiger-line-north-dakota-2025');
    expect(getDatasetVersions).toHaveBeenCalledWith(
      'tiger-line-north-dakota-2025',
    );
    expect(getDatasetMapLayers).toHaveBeenCalledWith(
      'tiger-line-north-dakota-2025',
    );
    expect(emitted).toEqual(
      DatasetsActions.datasetLoaded({ detail, versions, mapLayers }),
    );
  });

  /** forkJoin fails as a unit: a single failing request must not leave a half-populated page. */
  it('fails the whole load when only the map layers request errors', async () => {
    const effects = setup(
      {
        getDataset: vi.fn().mockReturnValue(of(detail)),
        getDatasetVersions: vi.fn().mockReturnValue(of(versions)),
      } as unknown as RepositoryDatasetsApi,
      {
        getDatasetMapLayers: vi
          .fn()
          .mockReturnValue(
            throwError(() => new Error('Map layers unavailable')),
          ),
      } as unknown as RepositoryMapsApi,
      of(
        DatasetsActions.datasetOpened({
          datasetId: 'tiger-line-north-dakota-2025',
        }),
      ),
    );

    const emitted = await firstValueFrom(effects.openDataset$);

    expect(emitted).toEqual(
      DatasetsActions.datasetFailed({ error: 'Map layers unavailable' }),
    );
  });

  it('uses a readable fallback message for a non-Error failure', async () => {
    const effects = setup(
      {
        getDataset: vi
          .fn()
          .mockReturnValue(throwError(() => ({ status: 404 }))),
        getDatasetVersions: vi.fn().mockReturnValue(of(versions)),
      } as unknown as RepositoryDatasetsApi,
      {
        getDatasetMapLayers: vi.fn().mockReturnValue(of(mapLayers)),
      } as unknown as RepositoryMapsApi,
      of(DatasetsActions.datasetOpened({ datasetId: 'missing' })),
    );

    const emitted = await firstValueFrom(effects.openDataset$);

    expect(emitted).toEqual(
      DatasetsActions.datasetFailed({
        error: 'Dataset detail failed to load.',
      }),
    );
  });
});
