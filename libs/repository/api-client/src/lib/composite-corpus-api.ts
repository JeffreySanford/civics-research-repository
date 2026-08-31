import { HttpClient, HttpParams } from '@angular/common/http';
import { Inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import type { components } from '../generated/repository-api.types';
import { REPOSITORY_API_BASE_URL } from './repository-api-client';

export type CompositeCorpusProfile = components['schemas']['CorpusProfile'];
export type CompositeFederatedSourceSystem =
  components['schemas']['FederatedSourceSystem'];
export type CompositeCorpusSourceRequest =
  components['schemas']['FederatedCompositeCorpusSourceRequest'];
export type CompositeCorpusCaptureRequest =
  components['schemas']['FederatedCompositeCorpusCaptureRequest'];
export type CompositeCorpusSourceEvidence =
  components['schemas']['FederatedCompositeCorpusSource'];
export type CompositeCorpusManifest =
  components['schemas']['FederatedCompositeCorpusManifest'];

@Injectable({ providedIn: 'root' })
export class RepositoryCompositeCorpusApi {
  constructor(
    private readonly http: HttpClient,
    @Inject(REPOSITORY_API_BASE_URL) private readonly baseUrl: string,
  ) {}

  getRecentCompositeCorpusEvidence(
    corpusProfile: CompositeCorpusProfile,
    limit = 20,
  ): Observable<readonly CompositeCorpusManifest[]> {
    const params = new HttpParams()
      .set('corpusProfile', corpusProfile)
      .set('limit', limit);
    return this.http.get<readonly CompositeCorpusManifest[]>(
      `${this.baseUrl}/admin/federation/compositions`,
      { params },
    );
  }

  getCompositeCorpusEvidence(
    compositionSha256: string,
  ): Observable<CompositeCorpusManifest> {
    return this.http.get<CompositeCorpusManifest>(
      `${this.baseUrl}/admin/federation/compositions/${encodeURIComponent(compositionSha256)}`,
    );
  }

  captureCompositeCorpusEvidence(
    request: CompositeCorpusCaptureRequest,
  ): Observable<CompositeCorpusManifest> {
    return this.http.post<CompositeCorpusManifest>(
      `${this.baseUrl}/admin/federation/compositions`,
      request,
    );
  }
}
