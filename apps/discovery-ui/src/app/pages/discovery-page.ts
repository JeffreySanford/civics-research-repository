import { AsyncPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
} from '@angular/core';
import { ReactiveFormsModule, FormControl } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Store } from '@ngrx/store';
import type { ResearchProgram, SearchQuery } from 'repository-api-client';
import { SearchActions } from '../state/search/search.actions';
import {
  selectSearchError,
  selectSearchFacets,
  selectSearchLoading,
  selectSearchResultSource,
  selectSearchResults,
  selectSearchTotalResults,
} from '../state/search/search.selectors';

const PAGE_SIZE = 25;

@Component({
  selector: 'app-discovery-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AsyncPipe,
    ReactiveFormsModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    RouterLink,
  ],
  templateUrl: './discovery-page.html',
})
export class DiscoveryPage implements OnInit {
  private readonly store = inject(Store);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly searchControl = new FormControl('', {
    nonNullable: true,
  });
  /**
   * Programs selected by default.
   *
   * The repository holds many programs; these three are the geospatial demo story. Sent explicitly
   * rather than relying on an omitted parameter, because omitting it means "every program" and the
   * facet must show what is actually applied.
   */
  protected readonly defaultPrograms: readonly ResearchProgram[] = [
    'TIGER_LINE',
    'LODES',
    'ACS',
  ];

  protected selectedPrograms: ResearchProgram[] = [...this.defaultPrograms];

  protected readonly programControl = new FormControl<ResearchProgram | ''>(
    '',
    { nonNullable: true },
  );
  protected readonly geographyControl = new FormControl('', {
    nonNullable: true,
  });

  protected readonly results$ = this.store.select(selectSearchResults);
  protected readonly resultSource$ = this.store.select(
    selectSearchResultSource,
  );
  protected readonly facets$ = this.store.select(selectSearchFacets);
  protected readonly totalResults$ = this.store.select(
    selectSearchTotalResults,
  );
  protected readonly loading$ = this.store.select(selectSearchLoading);
  protected readonly error$ = this.store.select(selectSearchError);

  ngOnInit(): void {
    const params = this.route.snapshot.queryParamMap;
    this.searchControl.setValue(params.get('q') ?? '');
    this.selectedPrograms = this.toResearchPrograms(params.getAll('program'));
    this.programControl.setValue(this.selectedPrograms[0] ?? '');
    this.geographyControl.setValue(params.get('geography') ?? '');

    this.submitSearch();
  }

  protected submitSearch(): void {
    this.updateSearchUrl();
    this.dispatchSearch();
  }

  private dispatchSearch(): void {
    const baseQuery: SearchQuery = {
      q: this.searchControl.value,
      page: 0,
      pageSize: PAGE_SIZE,
    };
    const query = {
      ...baseQuery,
      ...(this.selectedPrograms.length
        ? { programs: this.selectedPrograms }
        : {}),
      ...(this.geographyControl.value
        ? { geography: this.geographyControl.value }
        : {}),
    };

    this.store.dispatch(SearchActions.searchSubmitted({ query }));
  }

  /** Toggles one program in or out of the selection, rather than replacing it. */
  protected toggleProgram(program: string): void {
    const value = program as ResearchProgram;
    this.selectedPrograms = this.selectedPrograms.includes(value)
      ? this.selectedPrograms.filter((selected) => selected !== value)
      : [...this.selectedPrograms, value];
    this.programControl.setValue(this.selectedPrograms[0] ?? '');
    this.submitSearch();
  }

  protected selectGeography(geography: string): void {
    this.geographyControl.setValue(geography);
    this.submitSearch();
  }

  protected selectFacet(field: string, value: string): void {
    if (field === 'program') {
      this.toggleProgram(value);
      return;
    }

    if (field === 'geography') {
      this.selectGeography(value);
    }
  }

  protected resetPrograms(): void {
    this.selectedPrograms = [...this.defaultPrograms];
    this.programControl.setValue(this.selectedPrograms[0] ?? '');
    this.submitSearch();
  }

  protected isProgramSelected(program: string): boolean {
    return this.selectedPrograms.includes(program as ResearchProgram);
  }

  protected clearFilters(): void {
    this.selectedPrograms = [];
    this.programControl.setValue('');
    this.geographyControl.setValue('');
    this.submitSearch();
  }

  private updateSearchUrl(): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        q: this.searchControl.value || null,
        program: this.selectedPrograms.length
          ? [...this.selectedPrograms]
          : null,
        geography: this.geographyControl.value || null,
      },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  private toResearchPrograms(values: readonly string[]): ResearchProgram[] {
    const parsed = values
      .map((value) => this.toResearchProgram(value))
      .filter((value): value is ResearchProgram => value !== '');

    // No program parameter at all means the first visit, which starts from the defaults. An
    // explicit empty selection is only reachable through Clear filters, which sets no parameter
    // either, so defaults are the honest reading of an absent parameter.
    return parsed.length > 0 ? parsed : [...this.defaultPrograms];
  }

  /**
   * Every program the contract defines.
   *
   * Derived from the generated contract type rather than hand-listed: an allowlist that silently
   * dropped unknown values meant adding a program to the schema left it unselectable in the UI,
   * with the URL parameter quietly discarded and the defaults restored instead.
   */
  private static readonly RESEARCH_PROGRAMS: readonly ResearchProgram[] = [
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

  private toResearchProgram(value: string | null): ResearchProgram | '' {
    if (
      value !== null &&
      (DiscoveryPage.RESEARCH_PROGRAMS as readonly string[]).includes(value)
    ) {
      return value as ResearchProgram;
    }

    return '';
  }
}
