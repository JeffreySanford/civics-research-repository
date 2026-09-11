import { Component, computed, inject, signal } from '@angular/core';
import { Store } from '@ngrx/store';
import type { SearchQuery } from 'repository-api-client';
import { MobileSearchActions } from './state/search/search.actions';
import {
  selectMobileSearchError,
  selectMobileSearchLoading,
  selectMobileSearchQuery,
  selectMobileSearchResponse,
} from './state/search/search.selectors';

@Component({
  selector: 'app-root',
  standalone: false,
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  private readonly store = inject(Store);

  readonly queryText = signal('');
  readonly submittedQuery = this.store.selectSignal(selectMobileSearchQuery);
  readonly response = this.store.selectSignal(selectMobileSearchResponse);
  readonly loading = this.store.selectSignal(selectMobileSearchLoading);
  readonly error = this.store.selectSignal(selectMobileSearchError);
  readonly resultCount = computed(() => this.response()?.totalResults ?? 0);
  readonly activeQueryText = computed(
    () => this.submittedQuery().q?.trim() ?? '',
  );

  updateQuery(event: Event): void {
    this.queryText.set((event.target as HTMLInputElement).value);
  }

  submitSearch(event: SubmitEvent): void {
    event.preventDefault();
    const q = this.queryText().trim();
    const query: SearchQuery = {
      page: 0,
      pageSize: 10,
      ...(q ? { q } : {}),
    };

    this.store.dispatch(MobileSearchActions.searchSubmitted({ query }));
  }
}
