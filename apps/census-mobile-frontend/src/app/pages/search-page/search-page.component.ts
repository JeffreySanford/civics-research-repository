import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  OnInit,
  signal,
  ViewChild,
} from '@angular/core';
import { FormControl } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Store } from '@ngrx/store';
import type {
  ResearchObjectType,
  SearchQuery,
  SourceSystem,
} from 'repository-api-client';
import { SearchActions } from '../../state/search/search.actions';
import {
  selectSearchError,
  selectSearchFacets,
  selectSearchLoading,
  selectSearchPagination,
  selectSearchQuery,
  selectSearchResponse,
  selectSearchResults,
  selectSearchResultSource,
  selectSearchTotalResults,
} from '../../state/search/search.selectors';

type FilterField =
  | 'program'
  | 'publisher'
  | 'sourceSystem'
  | 'geography'
  | 'type'
  | 'vintageYear';

interface ActiveFilter {
  readonly key: string;
  readonly field: FilterField;
  readonly value: string;
  readonly label: string;
}

const PAGE_SIZE = 20;

@Component({
  selector: 'app-search-page',
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './search-page.component.html',
  styleUrl: './search-page.component.scss',
})
export class SearchPageComponent implements OnInit {
  private readonly store = inject(Store);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly searchControl = new FormControl('', { nonNullable: true });
  protected readonly filtersOpen = signal(false);

  protected readonly query = this.store.selectSignal(selectSearchQuery);
  protected readonly response = this.store.selectSignal(selectSearchResponse);
  protected readonly results = this.store.selectSignal(selectSearchResults);
  protected readonly facets = this.store.selectSignal(selectSearchFacets);
  protected readonly totalResults = this.store.selectSignal(
    selectSearchTotalResults,
  );
  protected readonly pagination = this.store.selectSignal(
    selectSearchPagination,
  );
  protected readonly resultSource = this.store.selectSignal(
    selectSearchResultSource,
  );
  protected readonly loading = this.store.selectSignal(selectSearchLoading);
  protected readonly error = this.store.selectSignal(selectSearchError);

  protected readonly activeFilters = computed<readonly ActiveFilter[]>(() => {
    const query = this.query();
    const filters: ActiveFilter[] = [];

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

  @ViewChild('filterTrigger')
  private readonly filterTrigger?: ElementRef<HTMLButtonElement>;

  @ViewChild('resultsHeading')
  private readonly resultsHeading?: ElementRef<HTMLElement>;

  ngOnInit(): void {
    const query = this.queryFromRoute();
    this.searchControl.setValue(query.q ?? '');
    this.store.dispatch(SearchActions.searchSubmitted({ query }));
  }

  protected submitSearch(): void {
    const query: SearchQuery = {
      ...this.query(),
      q: this.searchControl.value.trim(),
      page: 0,
      pageSize: PAGE_SIZE,
    };

    this.dispatchSearch(query);
  }

  protected openFilters(): void {
    this.filtersOpen.set(true);
  }

  protected closeFilters(): void {
    this.filtersOpen.set(false);
    queueMicrotask(() => this.filterTrigger?.nativeElement.focus());
  }

  protected isSupportedFacet(field: string): field is FilterField {
    return [
      'program',
      'publisher',
      'sourceSystem',
      'geography',
      'type',
      'vintageYear',
    ].includes(field);
  }

  protected isFacetSelected(field: FilterField, value: string): boolean {
    const query = this.query();

    switch (field) {
      case 'program':
        return query.programs?.includes(value) ?? false;
      case 'publisher':
        return query.publisher === value;
      case 'sourceSystem':
        return query.sourceSystem === value;
      case 'geography':
        return query.geography === value;
      case 'type':
        return query.contentType === value;
      case 'vintageYear':
        return String(query.vintageYear ?? '') === value;
    }
  }

  protected selectFacet(field: FilterField, value: string): void {
    const current = this.query();
    let query: SearchQuery = { ...current, page: 0, pageSize: PAGE_SIZE };

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
      case 'sourceSystem':
        query = {
          ...query,
          sourceSystem:
            current.sourceSystem === value
              ? undefined
              : (value as SourceSystem),
        };
        break;
      case 'geography':
        query = {
          ...query,
          geography: current.geography === value ? undefined : value,
        };
        break;
      case 'type':
        query = {
          ...query,
          contentType:
            current.contentType === value
              ? undefined
              : (value as ResearchObjectType),
        };
        break;
      case 'vintageYear': {
        const year = Number(value);
        query = {
          ...query,
          vintageYear:
            current.vintageYear === year || !Number.isInteger(year)
              ? undefined
              : year,
        };
        break;
      }
    }

    this.dispatchSearch(query);
  }

  protected clearFilters(): void {
    this.dispatchSearch({
      q: this.query().q ?? '',
      page: 0,
      pageSize: PAGE_SIZE,
    });
  }

  protected removeFilter(filter: ActiveFilter): void {
    this.selectFacet(filter.field, filter.value);
  }

  protected goToPage(page: number): void {
    const nextPage = Math.max(0, page);
    const query = { ...this.query(), page: nextPage };
    const navigation = this.updateUrl(query);
    this.store.dispatch(SearchActions.searchPageRequested({ page: nextPage }));

    void navigation.then(() => {
      requestAnimationFrame(() => {
        const heading = this.resultsHeading?.nativeElement;
        heading?.focus({ preventScroll: true });
        heading?.scrollIntoView({ block: 'start', inline: 'nearest' });
      });
    });
  }

  private dispatchSearch(query: SearchQuery): void {
    void this.updateUrl(query);
    this.store.dispatch(SearchActions.searchSubmitted({ query }));
  }

  private queryFromRoute(): SearchQuery {
    const params = this.route.snapshot.queryParamMap;
    const programs = params
      .getAll('program')
      .map((program) => program.trim())
      .filter(Boolean);
    const vintageYear = Number(params.get('vintageYear'));
    const page = Number(params.get('page'));

    return {
      q: params.get('q')?.trim() ?? '',
      page: Number.isInteger(page) && page > 0 ? page : 0,
      pageSize: PAGE_SIZE,
      ...(programs.length ? { programs } : {}),
      ...(params.get('publisher')
        ? { publisher: params.get('publisher') ?? undefined }
        : {}),
      ...(params.get('sourceSystem')
        ? { sourceSystem: params.get('sourceSystem') as SourceSystem }
        : {}),
      ...(params.get('geography')
        ? { geography: params.get('geography') ?? undefined }
        : {}),
      ...(params.get('type')
        ? { contentType: params.get('type') as ResearchObjectType }
        : {}),
      ...(Number.isInteger(vintageYear) && vintageYear > 0
        ? { vintageYear }
        : {}),
    };
  }

  private updateUrl(query: SearchQuery): Promise<boolean> {
    return this.router.navigate([], {
      relativeTo: this.route,
      replaceUrl: true,
      queryParams: {
        q: query.q || null,
        program: query.programs?.length ? [...query.programs] : null,
        publisher: query.publisher || null,
        sourceSystem: query.sourceSystem || null,
        geography: query.geography || null,
        type: query.contentType || null,
        vintageYear: query.vintageYear ?? null,
        page: (query.page ?? 0) > 0 ? query.page : null,
      },
    });
  }

  private addFilter(
    filters: ActiveFilter[],
    field: FilterField,
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
    return value
      .replaceAll('_', ' ')
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  }
}
