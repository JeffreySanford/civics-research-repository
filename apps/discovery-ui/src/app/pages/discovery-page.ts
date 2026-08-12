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
    this.programControl.setValue(this.toResearchProgram(params.get('program')));
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
      ...(this.programControl.value
        ? { program: this.programControl.value }
        : {}),
      ...(this.geographyControl.value
        ? { geography: this.geographyControl.value }
        : {}),
    };

    this.store.dispatch(SearchActions.searchSubmitted({ query }));
  }

  protected selectProgram(program: string): void {
    this.programControl.setValue(program as ResearchProgram);
    this.submitSearch();
  }

  protected selectGeography(geography: string): void {
    this.geographyControl.setValue(geography);
    this.submitSearch();
  }

  protected selectFacet(field: string, value: string): void {
    if (field === 'program') {
      this.selectProgram(value);
      return;
    }

    if (field === 'geography') {
      this.selectGeography(value);
    }
  }

  protected clearFilters(): void {
    this.programControl.setValue('');
    this.geographyControl.setValue('');
    this.submitSearch();
  }

  private updateSearchUrl(): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        q: this.searchControl.value || null,
        program: this.programControl.value || null,
        geography: this.geographyControl.value || null,
      },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  private toResearchProgram(value: string | null): ResearchProgram | '' {
    if (
      value === 'ACS' ||
      value === 'CPS' ||
      value === 'LODES' ||
      value === 'SIPP' ||
      value === 'TIGER_LINE' ||
      value === 'USGS'
    ) {
      return value;
    }

    return '';
  }
}
