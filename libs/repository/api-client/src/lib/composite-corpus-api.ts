import { HttpClient, HttpParams } from '@angular/common/http';
import { Inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import type { components } from '../generated/repository-api.types';
import { REPOSITORY_API_BASE_URL } from './repository-api-client';

export type CompositeCorpusProfile = components['schemas']['CorpusProfile'];
export type CompositeFederatedSourceSystem =
  components['schemas']['FederatedSourceSystem'];

export interface CompositeCorpusSourceRequest {
  readonly sourceSystem: CompositeFederatedSourceSystem;
  readonly requestedRecordCount: number;
  readonly snapshotId: string;
}

export interface CompositeCorpusCaptureRequest {
  readonly corpusProfile: CompositeCorpusProfile;
  readonly sources: readonly CompositeCorpusSourceRequest[];
}

export interface CompositeCorpusSourceEvidence {
  readonly sourceSystem: CompositeFederatedSourceSystem;
  readonly requestedRecordCount: number;
  readonly snapshotId: string;
  readonly runId: string;
  readonly runAdapterVersion: string;
  readonly recordAdapterVersions: readonly string[];
  readonly retainedRecordCount: number;
  readonly sha256: string;
  readonly snapshotCapturedAt: string;
}

export interface CompositeCorpusManifest {
  readonly compositionVersion: string;
  readonly mode: 'COMPOSITE_SNAPSHOT';
  readonly corpusProfile: CompositeCorpusProfile;
  readonly sources: readonly CompositeCorpusSourceEvidence[];
  readonly federatedRecordCount: number;
  readonly compositionSha256: string;
  readonly capturedAt: string;
}

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
