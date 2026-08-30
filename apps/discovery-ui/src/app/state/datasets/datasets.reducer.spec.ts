import { DatasetsActions } from './datasets.actions';
import { datasetsReducer, initialDatasetsState } from './datasets.reducer';
import { selectResearchObjectDetail } from './datasets.selectors';

describe('datasetsReducer', () => {
  const detail = {
    source: 'REPOSITORY' as const,
    id: 'tiger-line-north-dakota-2025',
    title: '2025 TIGER/Line - Census Tracts - North Dakota',
    program: 'TIGER_LINE' as const,
    publisher: 'U.S. Census Bureau',
    abstractText: 'Boundary metadata.',
    geography: 'North Dakota',
    vintageYear: 2025,
    releasedOn: '2025-08-01',
    files: [],
    citation: 'U.S. Census Bureau. TIGER/Line.',
    sourceUrl: 'https://example.test/tiger',
    accessibilityEvidenceStatus: 'AUTOMATED_PASS' as const,
    relatedResearch: [],
    origin: 'REPOSITORY' as const,
    sourceSystem: 'CENSUS' as const,
  };

  it('tracks opened dataset loading state without retaining prior detail', () => {
    const state = datasetsReducer(
      {
        ...initialDatasetsState,
        detail,
        versions: [{ id: 'old', label: 'Old', current: true }],
        mapLayers: [{} as never],
      },
      DatasetsActions.datasetOpened({ datasetId: detail.id }),
    );

    expect(state.selectedDatasetId).toBe(detail.id);
    expect(state.detail).toBeNull();
    expect(state.versions).toEqual([]);
    expect(state.mapLayers).toEqual([]);
    expect(state.loading).toBe(true);
  });

  it('tracks canonical research loading without retaining dataset-only authority claims', () => {
    const state = datasetsReducer(
      {
        ...initialDatasetsState,
        selectedDatasetId: detail.id,
        detail,
        versions: [{ id: 'old', label: 'Old', current: true }],
        mapLayers: [{} as never],
      },
      DatasetsActions.researchOpened({
        researchId: 'REFUQV9HT1Y6aHR0cHM6Ly9leGFtcGxlLmdvdg',
      }),
    );

    expect(state.selectedDatasetId).toBeNull();
    expect(state.detail).toBeNull();
    expect(state.versions).toEqual([]);
    expect(state.mapLayers).toEqual([]);
    expect(state.loading).toBe(true);
    expect(state.error).toBeNull();
  });

  it('stores loaded dataset detail', () => {
    const state = datasetsReducer(
      initialDatasetsState,
      DatasetsActions.datasetLoaded({
        detail,
        versions: [],
        mapLayers: [],
      }),
    );

    expect(state.detail).toEqual(detail);
    expect(state.loading).toBe(false);
  });

  it('selects current dataset detail', () => {
    const selected = selectResearchObjectDetail.projector({
      ...initialDatasetsState,
      detail,
    });

    expect(selected).toBe(detail);
  });
});
