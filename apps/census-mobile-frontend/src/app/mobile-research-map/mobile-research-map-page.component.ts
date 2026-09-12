import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ActivatedRoute, Params } from '@angular/router';
import type { SearchQuery } from 'repository-api-client';
import { map, shareReplay } from 'rxjs';
import { SearchRouteQueryAdapter } from '../state/search/search-route-query.adapter';

@Component({
  selector: 'app-mobile-research-map-page',
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './mobile-research-map-page.component.html',
  styleUrl: './mobile-research-map-page.component.scss',
})
export class MobileResearchMapPageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly queryAdapter = inject(SearchRouteQueryAdapter);

  protected readonly query$ = this.route.queryParamMap.pipe(
    map((params) => this.queryAdapter.fromParamMap(params)),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  protected queryParams(query: SearchQuery): Params {
    return this.queryAdapter.toQueryParams(query);
  }

  protected queryLabel(query: SearchQuery): string {
    return query.q?.trim() || 'Current repository search';
  }
}
