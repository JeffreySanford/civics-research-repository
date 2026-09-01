import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import {
  RepositorySearchComparisonApi,
  parseRepositoryError,
  type ResearchObjectType,
  type ResearchProgram,
  type SearchComparisonRequest,
  type SearchComparisonResponse,
  type SearchComparisonScenario,
  type SearchComparisonScenarioId,
  type SearchEngineComparison,
  type SourceSystem,
} from 'repository-api-client';
import { finalize } from 'rxjs';

@Component({
  selector: 'app-search-lab-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    MatButtonModule,
    MatProgressSpinnerModule,
    ReactiveFormsModule,
  ],
  templateUrl: './search-lab-page.html',
  styleUrl: './search-lab-page.scss',
})
export class SearchLabPage implements OnInit {
  private readonly comparisonApi = inject(RepositorySearchComparisonApi);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly scenarios = signal<readonly SearchComparisonScenario[]>(
    [],
  );
  protected readonly loadingScenarios = signal(false);
  protected readonly running = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly result = signal<SearchComparisonResponse | null>(null);
  protected readonly completionAnnouncement = signal<string | null>(null);

  protected readonly scenarioControl =
    new FormControl<SearchComparisonScenarioId>('FACETED_SEARCH', {
      nonNullable: true,
    });
  protected readonly queryControl = new FormControl('North Dakota workforce', {
    nonNullable: true,
  });
  protected readonly geographyControl = new FormControl('North Dakota', {
    nonNullable: true,
  });
  protected readonly publisherControl = new FormControl('', {
    nonNullable: true,
  });
  protected readonly sourceSystemControl = new FormControl<SourceSystem | ''>(
    '',
    { nonNullable: true },
  );
  protected readonly localIdControl = new FormControl('', {
    nonNullable: true,
  });
  protected readonly doiControl = new FormControl('', {
    nonNullable: true,
  });
  protected readonly programControl = new FormControl<ResearchProgram | ''>(
    '',
    {
      nonNullable: true,
    },
  );
  protected readonly contentTypeControl = new FormControl<
    ResearchObjectType | ''
  >('', { nonNullable: true });
  protected readonly vintageYearControl = new FormControl<number | null>(null);

  protected readonly programs: readonly ResearchProgram[] = [
    'ACS',
    'SIPP',
    'CPS',
    'LEHD',
    'LODES',
    'TIGER_LINE',
    'USGS',
    'ECONOMIC_CENSUS',
    'COUNTY_BUSINESS_PATTERNS',
    'BUILDING_PERMITS',
    'POPULATION_ESTIMATES',
    'SAIPE',
    'BUSINESS_DYNAMICS',
    'USGS_3DEP',
    'USGS_3HP',
    'OTHER',
  ];

  protected readonly contentTypes: readonly ResearchObjectType[] = [
    'DATASET',
    'PUBLICATION',
    'CODE',
    'METHODOLOGY',
    'SUPPORTING_MATERIAL',
    'PROJECT',
  ];

  protected readonly sourceSystems: readonly SourceSystem[] = [
    'CENSUS',
    'USGS',
    'DATA_GOV',
    'DOE_OSTI',
    'NASA_CMR',
    'PUBMED',
    'OPENALEX',
    'OTHER',
  ];

  ngOnInit(): void {
    this.loadScenarios();
  }

  protected runComparison(): void {
    const request: SearchComparisonRequest = {
      scenario: this.scenarioControl.value,
      query: this.queryControl.value.trim(),
      page: 0,
      pageSize: 10,
      ...(this.programControl.value
        ? { programs: [this.programControl.value] }
        : {}),
      ...(this.publisherControl.value.trim()
        ? { publisher: this.publisherControl.value.trim() }
        : {}),
      ...(this.sourceSystemControl.value
        ? { sourceSystem: this.sourceSystemControl.value }
        : {}),
      ...(this.localIdControl.value.trim()
        ? { localId: this.localIdControl.value.trim() }
        : {}),
      ...(this.doiControl.value.trim()
        ? { doi: this.doiControl.value.trim() }
        : {}),
      ...(this.geographyControl.value.trim()
        ? { geography: this.geographyControl.value.trim() }
        : {}),
      ...(this.contentTypeControl.value
        ? { contentType: this.contentTypeControl.value }
        : {}),
      ...(this.vintageYearControl.value !== null &&
      Number.isInteger(this.vintageYearControl.value)
        ? { vintageYear: this.vintageYearControl.value }
        : {}),
    };

    this.error.set(null);
    this.completionAnnouncement.set(null);
    this.running.set(true);

    this.comparisonApi
      .run(request)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.running.set(false)),
      )
      .subscribe({
        next: (response) => {
          this.result.set(response);
          this.completionAnnouncement.set(
            `Comparison complete. Solr returned ${response.solr.returnedHits} results and OpenSearch returned ${response.openSearch.returnedHits} results. Projection parity is ${response.sameProjection ? 'verified' : 'not verified'}.`,
          );
        },
        error: (error: unknown) => {
          this.error.set(
            parseRepositoryError(error, 'Search comparison failed to run.')
              .message,
          );
        },
      });
  }

  protected clearFilters(): void {
    this.geographyControl.setValue('');
    this.publisherControl.setValue('');
    this.sourceSystemControl.setValue('');
    this.localIdControl.setValue('');
    this.doiControl.setValue('');
    this.programControl.setValue('');
    this.contentTypeControl.setValue('');
    this.vintageYearControl.setValue(null);
  }

  protected engineLabel(engine: SearchEngineComparison): string {
    return engine.engine === 'OPENSEARCH' ? 'OpenSearch' : 'Solr';
  }

  protected scenarioDescription(): string {
    return (
      this.scenarios().find(
        (scenario) => scenario.id === this.scenarioControl.value,
      )?.description ?? ''
    );
  }

  private loadScenarios(): void {
    this.loadingScenarios.set(true);
    this.comparisonApi
      .listScenarios()
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.loadingScenarios.set(false)),
      )
      .subscribe({
        next: (scenarios) => this.scenarios.set(scenarios),
        error: (error: unknown) =>
          this.error.set(
            parseRepositoryError(
              error,
              'Search comparison scenarios failed to load.',
            ).message,
          ),
      });
  }
}
