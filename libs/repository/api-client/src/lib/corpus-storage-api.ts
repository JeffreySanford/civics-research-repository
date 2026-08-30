import { HttpClient } from '@angular/common/http';
import { Inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import type { components } from '../generated/repository-api.types';
import {
  REPOSITORY_API_BASE_URL,
  type DiscoveryProjectionState,
} from './repository-api-client';

export type CorpusProfile = components['schemas']['CorpusProfile'];
export type DeploymentTopology = components['schemas']['DeploymentTopology'];
export type CorpusStorageMeasurement =
  components['schemas']['CorpusStorageMeasurement'];
export type CorpusProfileSummary =
  components['schemas']['CorpusProfileSummary'];
export type CorpusStorageOverview =
  components['schemas']['CorpusStorageOverview'];

export type CorpusProfileActivationPhase =
  | 'IDLE'
  | 'PREPARING'
  | 'PROJECTING'
  | 'VERIFYING'
  | 'COMPLETED'
  | 'FAILED';

export interface CorpusProfileActivationProgress {
  readonly operationId?: string | null;
  readonly profile?: CorpusProfile | null;
  readonly phase: CorpusProfileActivationPhase;
  readonly processedDocuments: number;
  readonly totalDocuments?: number | null;
  readonly percentComplete: number;
  readonly startedAt?: string | null;
  readonly updatedAt: string;
  readonly completedAt?: string | null;
  readonly elapsedMs: number;
  readonly documentsPerSecond?: number | null;
  readonly message?: string | null;
}

@Injectable({ providedIn: 'root' })
export class RepositoryCorpusStorageApi {
  constructor(
    private readonly http: HttpClient,
    @Inject(REPOSITORY_API_BASE_URL) private readonly baseUrl: string,
  ) {}

  getCorpusStorageOverview(): Observable<CorpusStorageOverview> {
    return this.http.get<CorpusStorageOverview>(
      `${this.baseUrl}/admin/corpus/storage`,
    );
  }

  activateCorpusProfile(
    profile: CorpusProfile,
  ): Observable<DiscoveryProjectionState> {
    return this.http.post<DiscoveryProjectionState>(
      `${this.baseUrl}/admin/reindex`,
      null,
      { params: { profile } },
    );
  }

  getCorpusProfileActivationProgress(): Observable<CorpusProfileActivationProgress> {
    return this.http.get<CorpusProfileActivationProgress>(
      `${this.baseUrl}/admin/reindex/progress`,
    );
  }

  captureCorpusStorage(): Observable<CorpusStorageMeasurement> {
    return this.http.post<CorpusStorageMeasurement>(
      `${this.baseUrl}/admin/corpus/storage/capture`,
      null,
    );
  }
}
