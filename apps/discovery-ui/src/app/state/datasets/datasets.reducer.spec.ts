import { DatasetsActions } from './datasets.actions';
import { datasetsReducer, initialDatasetsState } from './datasets.reducer';
import { selectDatasetDetail } from './datasets.selectors';

describe('datasetsReducer', () => {
  const detail = {
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
  };

  it('tracks opened dataset loading state', () => {
    const state = datasetsReducer(
      initialDatasetsState,
      DatasetsActions.datasetOpened({ datasetId: detail.id }),
    );

    expect(state.selectedDatasetId).toBe(detail.id);
    expect(state.loading).toBe(true);
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
    const selected = selectDatasetDetail.projector({
      ...initialDatasetsState,
      detail,
    });

    expect(selected).toBe(detail);
  });
});
