import {
  Component,
  computed,
  ElementRef,
  inject,
  OnInit,
  signal,
  ViewChild,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Store } from '@ngrx/store';
import type { SearchQuery } from 'repository-api-client';
import type {
  MobileActiveFilter,
  MobileFilterField,
  MobileFilterSelection,
} from './components/mobile-search-filters/mobile-search-filters.model';
import { MobileSearchActions } from './state/search/search.actions';
import {
  MOBILE_SEARCH_PAGE_SIZE,
  SearchRouteQueryAdapter,
} from './state/search/search-route-query.adapter';
import { selectMobileSearchState } from './state/search/search.selectors';

@Component({
  selector: 'app-root',
  standalone: false,
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App implements OnInit {
  private readonly store = inject(Store);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly routeQueryAdapter = inject(SearchRouteQueryAdapter);

  readonly queryText = signal('');
  readonly filtersOpen = signal(false);
  readonly searchState = this.store.selectSignal(selectMobileSearchState);
  readonly response = computed(() => this.searchState().response);
  readonly loading = computed(() => this.searchState().loading);
  readonly error = computed(() => this.searchState().error);
  readonly activeQueryText = computed(
    () => this.searchState().query.q?.trim() ?? '',
  );
  readonly facets = computed(() => this.response()?.facets ?? []);
  readonly activeFilters = computed<readonly MobileActiveFilter[]>(() => {
    const query = this.searchState().query;
    const filters: MobileActiveFilter[] = [];

    for (const program of query.programs ?? []) {
      filters.push({
        key: `program:${program}`,
        field: 'program',
        value: program,
        label: this.readableValue(program),
      });
    }

    this.addFilter(filters, 'publisher', query.publisher);
    this.addFilter(filters, 'sourceSystem', query.sourceSystem);
    this.addFilter(filters, 'geography', query.geography);
    this.addFilter(filters, 'type', query.contentType);
    this.addFilter(
      filters,
      'vintageYear',
      query.vintageYear === undefined ? undefined : String(query.vintageYear),
    );

    return filters;
  });
  readonly resultCount = computed(() => this.response()?.totalResults ?? 0);
  readonly resultTypeFacet = computed(
    () =>
      this.response()?.facets.find((facet) => facet.field === 'type') ?? null,
  );
  readonly totalPages = computed(() => {
    const response = this.response();
    return response
      ? Math.max(1, Math.ceil(response.totalResults / response.pageSize))
      : 0;
  });
  readonly currentPageNumber = computed(() => (this.response()?.page ?? 0) + 1);
  readonly resultStart = computed(() => {
    const response = this.response();
    return response && response.totalResults > 0
      ? response.page * response.pageSize + 1
      : 0;
  });
  readonly resultEnd = computed(() => {
    const response = this.response();
    return response
      ? Math.min((response.page + 1) * response.pageSize, response.totalResults)
      : 0;
  });
  readonly canPrevious = computed(
    () => !this.loading() && (this.response()?.page ?? 0) > 0,
  );
  readonly canNext = computed(() => {
    const state = this.searchState();
    const response = state.response;
    if (!response || state.loading) {
      return false;
    }

    if (state.cursorMode) {
      return state.nextCursor !== null;
    }

    return (response.page + 1) * response.pageSize < response.totalResults;
  });
  readonly paginationNotice = computed(
    () => this.searchState().paginationNotice,
  );

  @ViewChild('filterTrigger')
  private readonly filterTrigger?: ElementRef<HTMLButtonElement>;

  ngOnInit(): void {
    const params = this.route.snapshot.queryParamMap;
    if (!this.routeQueryAdapter.hasSearchIntent(params)) {
      return;
    }

    const query = this.routeQueryAdapter.fromParamMap(params);
    this.queryText.set(query.q ?? '');
    this.store.dispatch(MobileSearchActions.searchSubmitted({ query }));
  }

  updateQuery(event: Event): void {
    this.queryText.set((event.target as HTMLInputElement).value);
  }

  submitSearch(event: Event): void {
    event.preventDefault();
    this.dispatchSearch(this.queryWithCurrentFilters(this.queryText().trim()));
  }

  openFilters(): void {
    this.filtersOpen.set(true);
  }

  closeFilters(): void {
    this.filtersOpen.set(false);
    queueMicrotask(() => this.filterTrigger?.nativeElement.focus());
  }

  selectFilter(selection: MobileFilterSelection): void {
    this.selectFacet(selection.field, selection.value);
  }

  clearFilters(): void {
    const q = this.searchState().query.q?.trim();
    this.dispatchSearch({
      page: 0,
      pageSize: MOBILE_SEARCH_PAGE_SIZE,
      ...(q ? { q } : {}),
    });
  }

  removeFilter(filter: MobileActiveFilter): void {
    this.selectFacet(filter.field, filter.value);
  }

  previousPage(): void {
    const page = this.response()?.page ?? 0;
    if (page > 0) {
      this.store.dispatch(
        MobileSearchActions.pageRequested({ page: page - 1 }),
      );
    }
  }

  nextPage(): void {
    const page = this.response()?.page ?? 0;
    if (this.canNext()) {
      this.store.dispatch(
        MobileSearchActions.pageRequested({ page: page + 1 }),
      );
    }
  }

  globalRank(index: number): number {
    const response = this.response();
    if (!response) {
      return index + 1;
    }
    return response.page * response.pageSize + index + 1;
  }

  isTopRanked(index: number): boolean {
    return this.globalRank(index) <= 3;
  }

  private selectFacet(field: MobileFilterField, value: string): void {
    const current = this.searchState().query;
    let query: SearchQuery = {
      ...current,
      page: 0,
      pageSize: MOBILE_SEARCH_PAGE_SIZE,
    };

    switch (field) {
      case 'program': {
        const programs = current.programs ?? [];
        query = {
          ...query,
          programs: programs.includes(value)
            ? programs.filter((program) => program !== value)
            : [...programs, value],
        };
        break;
      }
      case 'publisher':
        query = {
          ...query,
          publisher: current.publisher === value ? undefined : value,
        };
        break;
      case 'sourceSystem': {
        const sourceSystem = this.routeQueryAdapter.parseSourceSystem(value);
        if (!sourceSystem) {
          return;
        }
        query = {
          ...query,
          sourceSystem:
            current.sourceSystem === sourceSystem ? undefined : sourceSystem,
        };
        break;
      }
      case 'geography':
        query = {
          ...query,
          geography: current.geography === value ? undefined : value,
        };
        break;
      case 'type': {
        const contentType = this.routeQueryAdapter.parseContentType(value);
        if (!contentType) {
          return;
        }
        query = {
          ...query,
          contentType:
            current.contentType === contentType ? undefined : contentType,
        };
        break;
      }
      case 'vintageYear': {
        const vintageYear = Number(value);
        if (!Number.isInteger(vintageYear) || vintageYear <= 0) {
          return;
        }
        query = {
          ...query,
          vintageYear:
            current.vintageYear === vintageYear ? undefined : vintageYear,
        };
        break;
      }
    }

    this.dispatchSearch(query);
  }

  private dispatchSearch(query: SearchQuery): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      replaceUrl: true,
      queryParams: this.routeQueryAdapter.toQueryParams(query),
    });
    this.store.dispatch(MobileSearchActions.searchSubmitted({ query }));
  }

  private queryWithCurrentFilters(q: string): SearchQuery {
    const current = this.searchState().query;
    return {
      page: 0,
      pageSize: MOBILE_SEARCH_PAGE_SIZE,
      ...(q ? { q } : {}),
      ...(current.programs?.length ? { programs: current.programs } : {}),
      ...(current.publisher ? { publisher: current.publisher } : {}),
      ...(current.sourceSystem ? { sourceSystem: current.sourceSystem } : {}),
      ...(current.geography ? { geography: current.geography } : {}),
      ...(current.contentType ? { contentType: current.contentType } : {}),
      ...(current.vintageYear !== undefined
        ? { vintageYear: current.vintageYear }
        : {}),
    };
  }

  private addFilter(
    filters: MobileActiveFilter[],
    field: MobileFilterField,
    value: string | undefined,
  ): void {
    if (!value) {
      return;
    }

    filters.push({
      key: `${field}:${value}`,
      field,
      value,
      label: this.readableValue(value),
    });
  }

  private readableValue(value: string): string {
    const knownLabels: Readonly<Record<string, string>> = {
      CENSUS: 'Census',
      USGS: 'USGS',
      DATA_GOV: 'Data.gov',
      DOE_OSTI: 'DOE OSTI',
      NASA_CMR: 'NASA CMR',
      PUBMED: 'PubMed',
      OPENALEX: 'OpenAlex',
      OTHER: 'Other',
      DATASET: 'Dataset',
      PUBLICATION: 'Publication',
      CODE: 'Code',
      METHODOLOGY: 'Methodology',
      SUPPORTING_MATERIAL: 'Supporting material',
      PROJECT: 'Project',
    };

    return (
      knownLabels[value] ??
      value
        .replaceAll('_', ' ')
        .replace(/\b\w/g, (letter) => letter.toUpperCase())
    );
  }
}
