import { HttpClient } from '@angular/common/http';
import { Inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import type { components } from '../generated/repository-api.types';
import { REPOSITORY_API_BASE_URL } from './repository-api-client';

export type SearchComparisonScenarioId =
  components['schemas']['SearchComparisonScenarioId'];
export type SearchComparisonScenario =
  components['schemas']['SearchComparisonScenario'];
export type SearchComparisonRequest =
  components['schemas']['SearchComparisonRequest'];
export type SearchComparisonProjection =
  components['schemas']['SearchComparisonProjection'];
export type SearchComparisonEngine =
  components['schemas']['SearchComparisonEngine'];
export type SearchEngineComparison =
  components['schemas']['SearchEngineComparison'];
export type SearchComparisonResponse =
  components['schemas']['SearchComparisonResponse'];

@Injectable({ providedIn: 'root' })
export class RepositorySearchComparisonApi {
  constructor(
    private readonly http: HttpClient,
    @Inject(REPOSITORY_API_BASE_URL) private readonly baseUrl: string,
  ) {}

  listScenarios(): Observable<SearchComparisonScenario[]> {
    return this.http.get<SearchComparisonScenario[]>(
      `${this.baseUrl}/search/comparison/scenarios`,
    );
  }

  run(request: SearchComparisonRequest): Observable<SearchComparisonResponse> {
    return this.http.post<SearchComparisonResponse>(
      `${this.baseUrl}/search/comparison/run`,
      request,
    );
  }
}
