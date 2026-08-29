import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import {
  RepositorySearchComparisonApi,
  type SearchComparisonRequest,
  type SearchComparisonResponse,
  type SearchComparisonScenario,
} from 'repository-api-client';
import { of, throwError } from 'rxjs';
import { SearchLabPage } from './search-lab-page';

const SCENARIOS: SearchComparisonScenario[] = [
  {
    id: 'FACETED_SEARCH',
    label: 'Facets vs aggregations',
    description: 'Compare field facets with terms aggregations.',
  },
  {
    id: 'FULL_TEXT_RELEVANCE',
    label: 'Full-text relevance',
    description: 'Compare weighted lexical relevance.',
  },
  {
    id: 'FILTERING',
    label: 'Filtering',
    description: 'Compare equivalent structured filters.',
  },
];

const baseEngine = {
  enabled: true,
  reachable: true,
  indexedDocumentCount: 181,
  returnedHits: 0,
  results: [],
  facets: [],
} as const;

const SUCCESS_RESPONSE: SearchComparisonResponse = {
  scenario: 'FACETED_SEARCH',
  projection: {
    source: 'REPOSITORY',
    objectCount: 181,
    projectionId:
      'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    rebuiltAt: '2026-08-29T18:03:07Z',
  },
  sameProjection: true,
  solr: {
    ...baseEngine,
    engine: 'SOLR',
    indexName: 'discovery',
    elapsedMs: 20,
    totalHits: 3,
  },
  openSearch: {
    ...baseEngine,
    engine: 'OPENSEARCH',
    indexName: 'discovery-comparison',
    elapsedMs: 46,
    totalHits: 3,
  },
};

interface SearchLabHarness {
  readonly scenarioControl: { setValue(value: 'FACETED_SEARCH' | 'FULL_TEXT_RELEVANCE' | 'FILTERING'): void };
  readonly queryControl: { setValue(value: string): void };
  readonly geographyControl: { setValue(value: string): void };
  readonly programControl: { setValue(value: 'LODES' | ''): void };
  readonly contentTypeControl: { setValue(value: 'DATASET' | ''): void };
  readonly vintageYearControl: { setValue(value: number | null): void };
  runComparison(): void;
  clearFilters(): void;
}

describe('SearchLabPage', () => {
  const render = async (
    runResult: SearchComparisonResponse | Error = SUCCESS_RESPONSE,
  ) => {
    const comparisonApi = {
      listScenarios: vi.fn(() => of(SCENARIOS)),
      run: vi.fn((_request: SearchComparisonRequest) =>
        runResult instanceof Error
          ? throwError(() => runResult)
          : of(runResult),
      ),
    };

    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [SearchLabPage],
      providers: [
        provideNoopAnimations(),
        {
          provide: RepositorySearchComparisonApi,
          useValue: comparisonApi,
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(SearchLabPage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    return {
      fixture,
      comparisonApi,
      component: fixture.componentInstance as unknown as SearchLabHarness,
    };
  };

  it('loads scenarios and explains the default scenario', async () => {
    const { fixture, comparisonApi } = await render();

    expect(comparisonApi.listScenarios).toHaveBeenCalledTimes(1);
    expect(fixture.nativeElement.textContent).toContain(
      'Compare field facets with terms aggregations.',
    );
  });

  it('constructs one normalized typed request from the comparison controls', async () => {
    const { fixture, comparisonApi, component } = await render();

    component.scenarioControl.setValue('FILTERING');
    component.queryControl.setValue('  North Dakota workforce  ');
    component.geographyControl.setValue('  North Dakota  ');
    component.programControl.setValue('LODES');
    component.contentTypeControl.setValue('DATASET');
    component.vintageYearControl.setValue(2023);
    component.runComparison();
    fixture.detectChanges();

    expect(comparisonApi.run).toHaveBeenCalledWith({
      scenario: 'FILTERING',
      query: 'North Dakota workforce',
      programs: ['LODES'],
      geography: 'North Dakota',
      contentType: 'DATASET',
      vintageYear: 2023,
      page: 0,
      pageSize: 10,
    });
    expect(fixture.nativeElement.textContent).toContain(
      'Projection parity verified.',
    );
    expect(fixture.nativeElement.textContent).toContain('20 ms');
    expect(fixture.nativeElement.textContent).toContain('46 ms');
  });

  it('keeps useful Solr evidence visible when OpenSearch is unavailable', async () => {
    const partial: SearchComparisonResponse = {
      ...SUCCESS_RESPONSE,
      sameProjection: false,
      openSearch: {
        ...SUCCESS_RESPONSE.openSearch,
        reachable: false,
        totalHits: undefined,
        warning: 'OpenSearch is not reachable.',
      },
    };
    const { fixture, component } = await render(partial);

    component.runComparison();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain(
      'Projection parity is not verified.',
    );
    expect(fixture.nativeElement.textContent).toContain('Solr');
    expect(fixture.nativeElement.textContent).toContain(
      'OpenSearch is not reachable.',
    );
    expect(fixture.nativeElement.textContent).toContain('3');
  });

  it('renders a normalized API failure as an alert', async () => {
    const { fixture, component } = await render(
      new Error('Comparison transport failed.'),
    );

    component.runComparison();
    fixture.detectChanges();

    const alert = fixture.nativeElement.querySelector('[role="alert"]');
    expect(alert?.textContent).toContain('Comparison transport failed.');
  });

  it('clears filters without changing the selected comparison scenario or query', async () => {
    const { comparisonApi, component } = await render();

    component.scenarioControl.setValue('FULL_TEXT_RELEVANCE');
    component.queryControl.setValue('workforce mobility');
    component.geographyControl.setValue('North Dakota');
    component.programControl.setValue('LODES');
    component.contentTypeControl.setValue('DATASET');
    component.vintageYearControl.setValue(2023);
    component.clearFilters();
    component.runComparison();

    expect(comparisonApi.run).toHaveBeenCalledWith({
      scenario: 'FULL_TEXT_RELEVANCE',
      query: 'workforce mobility',
      page: 0,
      pageSize: 10,
    });
  });
});
