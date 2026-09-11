import { Component, computed, inject, signal } from '@angular/core';
import { Store } from '@ngrx/store';
import type { SearchQuery } from 'repository-api-client';
import { MobileSearchActions } from './state/search/search.actions';
import { selectMobileSearchState } from './state/search/search.selectors';

@Component({
  selector: 'app-root',
  standalone: false,
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  private readonly store = inject(Store);

  readonly queryText = signal('');
  readonly searchState = this.store.selectSignal(selectMobileSearchState);
  readonly response = computed(() => this.searchState().response);
  readonly loading = computed(() => this.searchState().loading);
  readonly error = computed(() => this.searchState().error);
  readonly activeQueryText = computed(
    () => this.searchState().query.q?.trim() ?? '',
  );
  readonly resultCount = computed(() => this.response()?.totalResults ?? 0);
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

  updateQuery(event: Event): void {
    this.queryText.set((event.target as HTMLInputElement).value);
  }

  submitSearch(event: Event): void {
    event.preventDefault();
    const q = this.queryText().trim();
    const query: SearchQuery = {
      page: 0,
      pageSize: 10,
      ...(q ? { q } : {}),
    };

    this.store.dispatch(MobileSearchActions.searchSubmitted({ query }));
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
}
