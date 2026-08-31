import { HttpClient } from '@angular/common/http';
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
export type CompositeCorpusProjectionEvidence =
  components['schemas']['FederatedCompositeCorpusProjectionEvidence'];

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
    return this.http.get<readonly CompositeCorpusManifest[]>(
      `${this.baseUrl}/admin/federation/compositions`,
      { params: { corpusProfile, limit } },
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

  getRecentCompositeCorpusProjectionEvidence(
    corpusProfile: CompositeCorpusProfile,
    limit = 20,
  ): Observable<readonly CompositeCorpusProjectionEvidence[]> {
    return this.http.get<readonly CompositeCorpusProjectionEvidence[]>(
      `${this.baseUrl}/admin/federation/compositions/projections`,
      { params: { corpusProfile, limit } },
    );
  }

  getCompositeCorpusProjectionEvidence(
    compositionSha256: string,
  ): Observable<CompositeCorpusProjectionEvidence> {
    return this.http.get<CompositeCorpusProjectionEvidence>(
      `${this.baseUrl}/admin/federation/compositions/${encodeURIComponent(compositionSha256)}/projection`,
    );
  }

  projectCompositeCorpus(
    compositionSha256: string,
  ): Observable<CompositeCorpusProjectionEvidence> {
    return this.http.post<CompositeCorpusProjectionEvidence>(
      `${this.baseUrl}/admin/federation/compositions/${encodeURIComponent(compositionSha256)}/project`,
      null,
    );
  }
}
