import { HttpClient } from '@angular/common/http';
import { Inject, Injectable, InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import type { components } from '../generated/repository-api.types';

export const REPOSITORY_API_BASE_URL = new InjectionToken<string>(
  'REPOSITORY_API_BASE_URL',
  {
    factory: () => 'http://localhost:8080/api',
  },
);

export type SyncMode = components['schemas']['SyncMode'];
export type SyncSource = components['schemas']['SyncSource'];
export type SyncRequest = components['schemas']['SyncRequest'];
export type SyncJob = components['schemas']['SyncJob'];
export type SyncAction = components['schemas']['SyncAction'];

@Injectable({ providedIn: 'root' })
export class RepositoryAdminApi {
  constructor(
    private readonly http: HttpClient,
    @Inject(REPOSITORY_API_BASE_URL) private readonly baseUrl: string,
  ) {}

  startSync(request: SyncRequest): Observable<SyncJob> {
    return this.http.post<SyncJob>(`${this.baseUrl}/admin/sync`, request);
  }

  listSyncJobs(): Observable<SyncJob[]> {
    return this.http.get<SyncJob[]>(`${this.baseUrl}/admin/sync`);
  }

  getSyncJob(syncJobId: string): Observable<SyncJob> {
    return this.http.get<SyncJob>(`${this.baseUrl}/admin/sync/${syncJobId}`);
  }
}
