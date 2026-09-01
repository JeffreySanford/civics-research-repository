import { HttpClient } from '@angular/common/http';
import { Inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { REPOSITORY_API_BASE_URL } from './repository-api-client';
import type { CorpusProfile } from './corpus-storage-api';

export type CorpusArchiveIntegrityStatus =
  | 'NOT_CHECKED'
  | 'VERIFIED'
  | 'FAILED';

export type CorpusArchiveFreshnessStatus =
  | 'NOT_CHECKED'
  | 'NO_NEWER_MARKER'
  | 'UPDATE_AVAILABLE'
  | 'UNKNOWN';

export interface CorpusArchiveFreshnessMarker {
  readonly observedAt: string;
  readonly markerTimestamp: string;
  readonly markerId?: string | null;
}

export interface CorpusArchiveSourceFreshness {
  readonly sourceSystem: string;
  readonly status: CorpusArchiveFreshnessStatus;
  readonly currentMarker?: CorpusArchiveFreshnessMarker | null;
  readonly detail: string;
}

export interface CorpusArchiveSummary {
  readonly archiveId: string;
  readonly label: string;
  readonly profile: CorpusProfile;
  readonly createdAt: string;
  readonly recordCount: number;
  readonly sourceCounts: Readonly<Record<string, number>>;
  readonly compressedBytes: number;
  readonly archiveSha256: string;
  readonly logicalSha256: string;
  readonly compositionSha256?: string | null;
  readonly integrityStatus: CorpusArchiveIntegrityStatus;
  readonly integrityCheckedAt?: string | null;
  readonly integrityDetail: string;
  readonly freshnessStatus: CorpusArchiveFreshnessStatus;
  readonly freshnessCheckedAt?: string | null;
  readonly freshnessDetail: string;
  readonly sourceFreshness: Readonly<
    Record<string, CorpusArchiveSourceFreshness>
  >;
}

export interface CorpusArchiveCreateRequest {
  readonly profile: CorpusProfile;
  readonly label?: string | null;
}

export interface CorpusArchiveRestoreRequest {
  readonly replaceExisting: true;
  readonly activateProfileAfterRestore?: CorpusProfile | null;
}

export interface CorpusArchiveRestoreResult {
  readonly archive: CorpusArchiveSummary;
  readonly restoredRecordCount: number;
  readonly restoredSourceCounts: Readonly<Record<string, number>>;
  readonly activatedProfile: CorpusProfile;
  readonly projectionId?: string | null;
}

@Injectable({ providedIn: 'root' })
export class RepositoryCorpusArchiveApi {
  constructor(
    private readonly http: HttpClient,
    @Inject(REPOSITORY_API_BASE_URL) private readonly baseUrl: string,
  ) {}

  listArchives(): Observable<readonly CorpusArchiveSummary[]> {
    return this.http.get<readonly CorpusArchiveSummary[]>(
      `${this.baseUrl}/admin/corpus/archives`,
    );
  }

  createArchive(
    request: CorpusArchiveCreateRequest,
  ): Observable<CorpusArchiveSummary> {
    return this.http.post<CorpusArchiveSummary>(
      `${this.baseUrl}/admin/corpus/archives`,
      request,
    );
  }

  verifyArchive(archiveId: string): Observable<CorpusArchiveSummary> {
    return this.http.post<CorpusArchiveSummary>(
      `${this.baseUrl}/admin/corpus/archives/${encodeURIComponent(archiveId)}/verify`,
      null,
    );
  }

  checkFreshness(archiveId: string): Observable<CorpusArchiveSummary> {
    return this.http.post<CorpusArchiveSummary>(
      `${this.baseUrl}/admin/corpus/archives/${encodeURIComponent(archiveId)}/freshness`,
      null,
    );
  }

  restoreArchive(
    archiveId: string,
    request: CorpusArchiveRestoreRequest,
  ): Observable<CorpusArchiveRestoreResult> {
    return this.http.post<CorpusArchiveRestoreResult>(
      `${this.baseUrl}/admin/corpus/archives/${encodeURIComponent(archiveId)}/restore`,
      request,
    );
  }

  deleteArchive(archiveId: string): Observable<void> {
    return this.http.delete<void>(
      `${this.baseUrl}/admin/corpus/archives/${encodeURIComponent(archiveId)}`,
    );
  }
}
