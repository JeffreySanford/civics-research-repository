import { AsyncPipe, DatePipe, DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import {
  RepositoryCorpusArchiveApi,
  parseRepositoryError,
  type CorpusArchiveFreshnessStatus,
  type CorpusArchiveIntegrityStatus,
  type CorpusArchiveSummary,
  type CorpusProfile,
} from 'repository-api-client';
import {
  BehaviorSubject,
  catchError,
  finalize,
  of,
  shareReplay,
  switchMap,
} from 'rxjs';

interface PendingArchiveAction {
  readonly kind: 'RESTORE' | 'DELETE';
  readonly archive: CorpusArchiveSummary;
}

@Component({
  selector: 'app-admin-corpus-archives',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AsyncPipe,
    DatePipe,
    DecimalPipe,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatSelectModule,
  ],
  template: `
    <section class="corpus-archives" aria-labelledby="corpus-archives-heading">
      <div class="corpus-archives__heading-row">
        <div>
          <p class="eyebrow">Corpus preservation</p>
          <h2 id="corpus-archives-heading">Corpus archives</h2>
          <p>
            Preserve expensive federated metadata locally as immutable,
            checksummed archives. Search-profile changes rebuild Solr and
            OpenSearch without deleting the retained million-record corpus.
          </p>
        </div>
        <button
          mat-stroked-button
          type="button"
          (click)="refresh()"
          [disabled]="(busy$ | async) !== null"
        >
          Refresh archives
        </button>
      </div>

      <div class="corpus-archives__create">
        <mat-form-field appearance="outline">
          <mat-label>Archive profile</mat-label>
          <mat-select
            aria-label="Corpus profile to archive"
            [value]="selectedProfile"
            (valueChange)="selectedProfile = $event"
          >
            @for (profile of archiveProfiles; track profile) {
              <mat-option [value]="profile">{{ profile }}</mat-option>
            }
          </mat-select>
        </mat-form-field>

        <mat-form-field appearance="outline" class="corpus-archives__label">
          <mat-label>Archive label</mat-label>
          <input
            matInput
            maxlength="160"
            [value]="archiveLabel"
            (input)="updateLabel($event)"
            placeholder="C2 1M gold master"
          />
        </mat-form-field>

        <button
          mat-flat-button
          type="button"
          (click)="createArchive()"
          [disabled]="(busy$ | async) !== null"
        >
          Create archive
        </button>
      </div>

      <p class="corpus-archives__note">
        FEDERATED_1M archives require the exact 500K Data.gov + 500K DOE OSTI
        composition evidence. Archive creation is blocked while either source is
        actively harvesting.
      </p>

      @if (status$ | async; as status) {
        <p class="inline-status" role="status" aria-live="polite">
          {{ status }}
        </p>
      }

      @if (busy$ | async; as busy) {
        <div class="inline-status" role="status">
          <mat-spinner diameter="20" [attr.aria-label]="busy"></mat-spinner>
          <span>{{ busy }}</span>
        </div>
      }

      @if (pendingAction; as pending) {
        <section
          class="corpus-archives__confirmation"
          role="alertdialog"
          aria-modal="false"
          aria-labelledby="archive-confirm-heading"
          aria-describedby="archive-confirm-description"
        >
          <h3 id="archive-confirm-heading">
            {{
              pending.kind === 'RESTORE'
                ? 'Restore archive?'
                : 'Delete archive?'
            }}
          </h3>
          <p id="archive-confirm-description">
            <strong>{{ pending.archive.label }}</strong> was created
            {{ pending.archive.createdAt | date: 'medium' }} and contains
            {{ pending.archive.recordCount | number }} federated records.
            Archive SHA-256:
            <code>{{ shortSha(pending.archive.archiveSha256) }}</code
            >.
          </p>
          @if (pending.kind === 'RESTORE') {
            <p>
              Restore verifies the immutable checksums first, then replaces the
              currently retained federated metadata and rebuilds
              {{ pending.archive.profile }}. Existing source checkpoints are
              invalidated so an old cursor cannot resume against the restored
              corpus.
            </p>
          } @else {
            <p>
              Delete removes only this saved archive. It does not delete the
              currently retained corpus or the active search projection.
            </p>
          }
          <div class="button-row">
            <button
              mat-flat-button
              type="button"
              (click)="confirmPendingAction()"
              [disabled]="(busy$ | async) !== null"
            >
              {{
                pending.kind === 'RESTORE'
                  ? 'Restore archive'
                  : 'Delete archive'
              }}
            </button>
            <button
              mat-stroked-button
              type="button"
              (click)="pendingAction = null"
              [disabled]="(busy$ | async) !== null"
            >
              Cancel
            </button>
          </div>
        </section>
      }

      @if (archives$ | async; as archives) {
        @if (archives.length > 0) {
          <div class="corpus-archives__table-wrap">
            <table>
              <caption class="visually-hidden">
                Saved federated corpus archives and administrative actions
              </caption>
              <thead>
                <tr>
                  <th scope="col">Archive</th>
                  <th scope="col">Created</th>
                  <th scope="col">Records</th>
                  <th scope="col">Size</th>
                  <th scope="col">Integrity</th>
                  <th scope="col">Freshness</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                @for (archive of archives; track archive.archiveId) {
                  <tr>
                    <td>
                      <strong>{{ archive.label }}</strong>
                      <span>{{ archive.profile }}</span>
                      <span>{{ sourceCounts(archive) }}</span>
                      <code [title]="archive.archiveSha256">
                        {{ shortSha(archive.archiveSha256) }}
                      </code>
                      @if (archive.compositionSha256) {
                        <span>
                          Composition
                          <code [title]="archive.compositionSha256">
                            {{ shortSha(archive.compositionSha256) }}
                          </code>
                        </span>
                      }
                    </td>
                    <td>{{ archive.createdAt | date: 'medium' }}</td>
                    <td>{{ archive.recordCount | number }}</td>
                    <td>{{ formatBytes(archive.compressedBytes) }}</td>
                    <td>
                      <span
                        class="corpus-archives__badge"
                        [class.corpus-archives__badge--good]="
                          archive.integrityStatus === 'VERIFIED'
                        "
                        [class.corpus-archives__badge--bad]="
                          archive.integrityStatus === 'FAILED'
                        "
                      >
                        {{ integrityLabel(archive.integrityStatus) }}
                      </span>
                      @if (archive.integrityCheckedAt) {
                        <small>{{
                          archive.integrityCheckedAt | date: 'short'
                        }}</small>
                      }
                    </td>
                    <td>
                      <span
                        class="corpus-archives__badge"
                        [class.corpus-archives__badge--good]="
                          archive.freshnessStatus === 'NO_NEWER_MARKER'
                        "
                        [class.corpus-archives__badge--warn]="
                          archive.freshnessStatus === 'UPDATE_AVAILABLE'
                        "
                      >
                        {{ freshnessLabel(archive.freshnessStatus) }}
                      </span>
                      @if (archive.freshnessCheckedAt) {
                        <small>{{
                          archive.freshnessCheckedAt | date: 'short'
                        }}</small>
                      }
                    </td>
                    <td>
                      <div class="corpus-archives__actions">
                        <button
                          mat-stroked-button
                          type="button"
                          (click)="verifyArchive(archive)"
                          [disabled]="(busy$ | async) !== null"
                        >
                          Verify checksum
                        </button>
                        <button
                          mat-stroked-button
                          type="button"
                          (click)="checkFreshness(archive)"
                          [disabled]="(busy$ | async) !== null"
                        >
                          Check freshness
                        </button>
                        <button
                          mat-stroked-button
                          type="button"
                          (click)="requestRestore(archive)"
                          [disabled]="
                            (busy$ | async) !== null ||
                            archive.integrityStatus === 'FAILED'
                          "
                        >
                          Restore
                        </button>
                        <button
                          mat-stroked-button
                          type="button"
                          (click)="requestDelete(archive)"
                          [disabled]="(busy$ | async) !== null"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        } @else {
          <p class="corpus-archives__empty">
            No corpus archives have been created yet. Finish an evidence corpus,
            then preserve it here before switching profiles or resetting local
            persistence.
          </p>
        }
      }
    </section>
  `,
  styles: `
    :host {
      display: block;
      margin-top: 2rem;
      padding-top: 2rem;
      border-top: 1px solid var(--civics-border-subtle);
    }

    .corpus-archives__heading-row,
    .corpus-archives__create {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 1rem;
      flex-wrap: wrap;
    }

    .corpus-archives__heading-row > div:first-child {
      max-width: 60rem;
    }

    .corpus-archives__create {
      align-items: center;
      margin-top: 1.5rem;
      padding: 1rem;
      border: 1px solid var(--civics-border-subtle);
      border-radius: 0.75rem;
      background: var(--mat-sys-surface-container-low);
    }

    .corpus-archives__label {
      flex: 1 1 20rem;
    }

    .corpus-archives__note,
    .corpus-archives__empty,
    td span,
    td small {
      color: var(--mat-sys-on-surface-variant);
    }

    .corpus-archives__confirmation {
      margin: 1.5rem 0;
      padding: 1rem;
      border: 2px solid var(--mat-sys-outline);
      border-radius: 0.75rem;
      background: var(--mat-sys-surface-container);
    }

    .corpus-archives__confirmation h3 {
      margin-top: 0;
    }

    .corpus-archives__table-wrap {
      overflow-x: auto;
      margin-top: 1.5rem;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      min-width: 64rem;
    }

    th,
    td {
      padding: 0.8rem;
      border-bottom: 1px solid var(--civics-border-subtle);
      text-align: left;
      vertical-align: top;
    }

    th {
      color: var(--mat-sys-on-surface-variant);
      font-size: 0.75rem;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }

    td:first-child,
    td:nth-child(5),
    td:nth-child(6) {
      display: grid;
      gap: 0.3rem;
    }

    .corpus-archives__badge {
      display: inline-flex;
      width: fit-content;
      padding: 0.2rem 0.5rem;
      border-radius: 999px;
      background: var(--mat-sys-surface-container-high);
      font-size: 0.75rem;
      font-weight: 700;
    }

    .corpus-archives__badge--good {
      background: var(--mat-sys-secondary-container);
      color: var(--mat-sys-on-secondary-container);
    }

    .corpus-archives__badge--warn {
      background: var(--mat-sys-tertiary-container);
      color: var(--mat-sys-on-tertiary-container);
    }

    .corpus-archives__badge--bad {
      background: var(--mat-sys-error-container);
      color: var(--mat-sys-on-error-container);
    }

    .corpus-archives__actions {
      display: grid;
      gap: 0.5rem;
      min-width: 10rem;
    }

    .button-row {
      display: flex;
      gap: 0.75rem;
      flex-wrap: wrap;
    }

    code {
      overflow-wrap: anywhere;
    }
  `,
})
export class AdminCorpusArchivesComponent {
  private readonly api = inject(RepositoryCorpusArchiveApi);
  private readonly destroyRef = inject(DestroyRef);
  private readonly refreshSubject = new BehaviorSubject<void>(undefined);
  protected readonly busy$ = new BehaviorSubject<string | null>(null);
  protected readonly status$ = new BehaviorSubject<string | null>(null);

  protected readonly archiveProfiles: readonly CorpusProfile[] = [
    'FEDERATED_10K',
    'FEDERATED_100K',
    'FEDERATED_1M',
    'FULL',
  ];
  protected selectedProfile: CorpusProfile = 'FEDERATED_1M';
  protected archiveLabel = '';
  protected pendingAction: PendingArchiveAction | null = null;

  protected readonly archives$ = this.refreshSubject.pipe(
    switchMap(() =>
      this.api.listArchives().pipe(
        catchError((error: unknown) => {
          const parsed = parseRepositoryError(
            error,
            'Corpus archives could not be loaded.',
          );
          this.status$.next(parsed.message);
          return of([] as readonly CorpusArchiveSummary[]);
        }),
      ),
    ),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  protected refresh(): void {
    this.refreshSubject.next();
  }

  protected updateLabel(event: Event): void {
    this.archiveLabel = (event.target as HTMLInputElement).value;
  }

  protected createArchive(): void {
    this.run(
      'Creating checksummed corpus archive',
      this.api.createArchive({
        profile: this.selectedProfile,
        label: this.archiveLabel.trim() || null,
      }),
      (archive) => {
        this.status$.next(
          `Created ${archive.label} with ${archive.recordCount.toLocaleString()} records.`,
        );
        this.archiveLabel = '';
      },
    );
  }

  protected verifyArchive(archive: CorpusArchiveSummary): void {
    this.run(
      `Verifying ${archive.label}`,
      this.api.verifyArchive(archive.archiveId),
      (updated) => {
        this.status$.next(
          updated.integrityStatus === 'VERIFIED'
            ? `${updated.label} checksum verified.`
            : `${updated.label} failed checksum verification. Restore is blocked.`,
        );
      },
    );
  }

  protected checkFreshness(archive: CorpusArchiveSummary): void {
    this.run(
      `Checking publisher freshness for ${archive.label}`,
      this.api.checkFreshness(archive.archiveId),
      (updated) => {
        this.status$.next(
          `${updated.label}: ${this.freshnessLabel(updated.freshnessStatus)}.`,
        );
      },
    );
  }

  protected requestRestore(archive: CorpusArchiveSummary): void {
    this.pendingAction = { kind: 'RESTORE', archive };
  }

  protected requestDelete(archive: CorpusArchiveSummary): void {
    this.pendingAction = { kind: 'DELETE', archive };
  }

  protected confirmPendingAction(): void {
    const pending = this.pendingAction;
    if (!pending) {
      return;
    }
    this.pendingAction = null;

    if (pending.kind === 'DELETE') {
      this.run(
        `Deleting archive ${pending.archive.label}`,
        this.api.deleteArchive(pending.archive.archiveId),
        () => this.status$.next(`Deleted archive ${pending.archive.label}.`),
      );
      return;
    }

    this.run(
      `Restoring ${pending.archive.label}`,
      this.api.restoreArchive(pending.archive.archiveId, {
        replaceExisting: true,
        activateProfileAfterRestore: pending.archive.profile,
      }),
      (result) => {
        this.status$.next(
          `Restored ${result.restoredRecordCount.toLocaleString()} records and activated ${result.activatedProfile}.`,
        );
      },
    );
  }

  protected sourceCounts(archive: CorpusArchiveSummary): string {
    return Object.entries(archive.sourceCounts)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([source, count]) => `${source} ${count.toLocaleString()}`)
      .join(' · ');
  }

  protected shortSha(value: string): string {
    return value.length <= 16
      ? value
      : `${value.slice(0, 12)}…${value.slice(-4)}`;
  }

  protected formatBytes(bytes: number): string {
    if (!Number.isFinite(bytes) || bytes < 0) {
      return 'Unknown';
    }
    if (bytes < 1024) {
      return `${bytes} B`;
    }
    const units = ['KiB', 'MiB', 'GiB', 'TiB'];
    let value = bytes / 1024;
    let unit = units[0];
    for (let index = 1; index < units.length && value >= 1024; index++) {
      value /= 1024;
      unit = units[index];
    }
    return `${value.toFixed(value >= 10 ? 1 : 2)} ${unit}`;
  }

  protected integrityLabel(status: CorpusArchiveIntegrityStatus): string {
    switch (status) {
      case 'VERIFIED':
        return 'Verified';
      case 'FAILED':
        return 'Failed';
      default:
        return 'Not checked';
    }
  }

  protected freshnessLabel(status: CorpusArchiveFreshnessStatus): string {
    switch (status) {
      case 'NO_NEWER_MARKER':
        return 'No newer marker detected';
      case 'UPDATE_AVAILABLE':
        return 'Update available';
      case 'UNKNOWN':
        return 'Unknown';
      default:
        return 'Not checked';
    }
  }

  private run<T>(
    busyLabel: string,
    request: import('rxjs').Observable<T>,
    onSuccess: (value: T) => void,
  ): void {
    if (this.busy$.value !== null) {
      return;
    }
    this.busy$.next(busyLabel);
    this.status$.next(null);
    request
      .pipe(
        finalize(() => this.busy$.next(null)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (value) => {
          onSuccess(value);
          this.refreshSubject.next();
        },
        error: (error: unknown) => {
          const parsed = parseRepositoryError(error, `${busyLabel} failed.`);
          this.status$.next(parsed.message);
        },
      });
  }
}
