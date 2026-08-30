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
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import {
  RepositoryCorpusStorageApi,
  type CorpusProfile,
  type CorpusProfileSummary,
  type CorpusStorageMeasurement,
  type CorpusStorageOverview,
  type DiscoveryProjectionState,
} from 'repository-api-client';
import {
  BehaviorSubject,
  catchError,
  combineLatest,
  finalize,
  map,
  of,
  shareReplay,
  switchMap,
} from 'rxjs';

interface CorpusStorageView {
  readonly overview: CorpusStorageOverview;
  readonly activeProfile: CorpusProfileSummary;
  readonly viewedProfile: CorpusProfileSummary;
}

interface ActivationResult {
  readonly projection: DiscoveryProjectionState;
  readonly footprintCaptured: boolean;
}

@Component({
  selector: 'app-admin-corpus-storage',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AsyncPipe,
    DatePipe,
    DecimalPipe,
    MatButtonModule,
    MatFormFieldModule,
    MatProgressSpinnerModule,
    MatSelectModule,
  ],
  template: `
    <section class="corpus-storage" aria-labelledby="corpus-storage-heading">
      <div class="corpus-storage__heading-row">
        <div>
          <p class="eyebrow">Corpus evidence</p>
          <h2 id="corpus-storage-heading">Corpus scale & local storage</h2>
          <p>
            Compare and activate deterministic search profiles without deleting
            retained metadata. Normal <code>start:all</code> uses the fast
            curated profile; larger retained corpora are projected only when
            explicitly activated here.
          </p>
        </div>

        <button
          mat-stroked-button
          type="button"
          (click)="captureCurrentFootprint()"
          [disabled]="
            (capturing$ | async) === true || (activating$ | async) === true
          "
        >
          Capture current footprint
        </button>
      </div>

      @if (captureStatus$ | async; as status) {
        <p class="inline-status" role="status">{{ status }}</p>
      }

      @if (capturing$ | async) {
        <div class="inline-status" role="status">
          <mat-spinner
            diameter="20"
            aria-label="Capturing current corpus storage footprint"
          ></mat-spinner>
          <span>Measuring current local storage domains</span>
        </div>
      }

      @if (view$ | async; as view) {
        <dl class="corpus-storage__summary">
          <div>
            <dt>Active search profile</dt>
            <dd>{{ view.activeProfile.label }}</dd>
          </div>
          <div>
            <dt>Active projection</dt>
            <dd>
              @if (view.activeProfile.latestMeasurement; as measurement) {
                {{ measurement.activeProjectionCount | number }} documents
              } @else {
                Not measured
              }
            </dd>
          </div>
          <div>
            <dt>Retained federated metadata</dt>
            <dd>
              @if (view.activeProfile.latestMeasurement; as measurement) {
                {{ measurement.retainedFederatedCount | number }} records
              } @else {
                Not measured
              }
            </dd>
          </div>
        </dl>

        <div class="corpus-storage__profile-controls">
          <mat-form-field appearance="outline">
            <mat-label>View corpus profile</mat-label>
            <mat-select
              aria-label="View corpus profile"
              [value]="view.viewedProfile.profile"
              (valueChange)="selectProfile($event)"
            >
              @for (profile of view.overview.profiles; track profile.profile) {
                <mat-option [value]="profile.profile">
                  {{ profile.label }}{{ profile.active ? ' — active' : '' }}
                </mat-option>
              }
            </mat-select>
          </mat-form-field>

          <div class="corpus-storage__profile-note">
            @if (!view.viewedProfile.active) {
              <strong>Selecting a profile does not activate it.</strong>
              <span>
                Activation rebuilds Solr and OpenSearch from metadata already
                retained locally. It does not automatically harvest missing
                records.
              </span>
            } @else {
              <strong>This is the active search profile.</strong>
              <span>
                Retained federated metadata remains independent from the active
                projection.
              </span>
            }
          </div>
        </div>

        @if (!view.viewedProfile.active) {
          <div class="corpus-storage__activation-row">
            <div>
              @if (isHeavyProfile(view.viewedProfile.profile)) {
                <strong>Heavy profile.</strong>
                <span>
                  Activation can require substantial indexing time, memory, and
                  disk. The backend will refuse the operation if the required
                  retained metadata is not available.
                </span>
              } @else {
                <span>
                  Activate this deterministic projection from the currently
                  retained corpus.
                </span>
              }
            </div>
            <button
              mat-flat-button
              type="button"
              (click)="activateProfile(view.viewedProfile.profile)"
              [disabled]="
                (activating$ | async) === true || (capturing$ | async) === true
              "
            >
              Activate {{ view.viewedProfile.label }}
            </button>
          </div>
        }

        @if (activationStatus$ | async; as status) {
          <p class="inline-status" role="status">{{ status }}</p>
        }

        @if (activating$ | async) {
          <div class="inline-status" role="status">
            <mat-spinner
              diameter="20"
              aria-label="Activating corpus search profile"
            ></mat-spinner>
            <span>Building and verifying the selected search projection</span>
          </div>
        }

        <article
          class="corpus-storage__profile-card"
          [attr.aria-labelledby]="'profile-' + view.viewedProfile.profile"
        >
          <div class="corpus-storage__profile-title">
            <div>
              <p class="eyebrow">Viewed profile</p>
              <h3 [id]="'profile-' + view.viewedProfile.profile">
                {{ view.viewedProfile.label }}
              </h3>
            </div>
            @if (view.viewedProfile.active) {
              <span class="corpus-storage__badge">Active</span>
            } @else {
              <span
                class="corpus-storage__badge corpus-storage__badge--planned"
              >
                Inactive
              </span>
            }
          </div>

          <dl class="corpus-storage__profile-stats">
            <div>
              <dt>Target federated records</dt>
              <dd>
                @if (
                  view.viewedProfile.targetFederatedRecordCount !== undefined
                ) {
                  {{ view.viewedProfile.targetFederatedRecordCount | number }}
                } @else if (view.viewedProfile.profile === 'CURATED_DEMO') {
                  Curated repository only
                } @else {
                  All retained records
                }
              </dd>
            </div>

            @if (view.viewedProfile.latestMeasurement; as measurement) {
              <div>
                <dt>Active projection documents</dt>
                <dd>{{ measurement.activeProjectionCount | number }}</dd>
              </div>
              <div>
                <dt>Retained federated records</dt>
                <dd>{{ measurement.retainedFederatedCount | number }}</dd>
              </div>
              <div>
                <dt>Application PostgreSQL</dt>
                <dd>{{ formatBytes(measurement.applicationPostgresBytes) }}</dd>
              </div>
              <div>
                <dt>DSpace bitstreams</dt>
                <dd>{{ formatBytes(measurement.dspaceStoredBytes) }}</dd>
              </div>
              <div>
                <dt>Solr discovery index</dt>
                <dd>{{ formatBytes(measurement.solrIndexBytes) }}</dd>
              </div>
              <div>
                <dt>OpenSearch comparison index</dt>
                <dd>{{ formatBytes(measurement.openSearchIndexBytes) }}</dd>
              </div>
              <div>
                <dt>Known measured total</dt>
                <dd>{{ formatBytes(measurement.totalMeasuredLocalBytes) }}</dd>
              </div>
              <div>
                <dt>Topology</dt>
                <dd>{{ topologyLabel(measurement.topology) }}</dd>
              </div>
              <div>
                <dt>Captured</dt>
                <dd>{{ measurement.capturedAt | date: 'medium' }}</dd>
              </div>
              <div>
                <dt>Projection ID</dt>
                <dd>
                  @if (measurement.projectionId) {
                    <code [title]="measurement.projectionId">
                      {{ shortProjectionId(measurement.projectionId) }}
                    </code>
                  } @else {
                    Not recorded
                  }
                </dd>
              </div>
            } @else {
              <div class="corpus-storage__unmeasured">
                <dt>Latest measurement</dt>
                <dd>Not measured yet</dd>
              </div>
            }
          </dl>
        </article>

        <div class="corpus-storage__history">
          <h3>Historical local footprint</h3>
          <p>
            Immutable captures make bytes-per-record and standalone-versus-kind
            storage growth reviewable over time. Unknown subsystem values stay
            unknown rather than being recorded as zero.
          </p>

          @if (view.overview.history.length > 0) {
            <div class="corpus-storage__table-scroll" tabindex="0">
              <table>
                <caption class="visually-hidden">
                  Historical corpus scale and local storage measurements
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Captured</th>
                    <th scope="col">Profile</th>
                    <th scope="col">Topology</th>
                    <th scope="col">Active</th>
                    <th scope="col">Retained</th>
                    <th scope="col">Postgres</th>
                    <th scope="col">DSpace</th>
                    <th scope="col">Solr</th>
                    <th scope="col">OpenSearch</th>
                    <th scope="col">Known total</th>
                  </tr>
                </thead>
                <tbody>
                  @for (
                    measurement of view.overview.history;
                    track measurement.id
                  ) {
                    <tr>
                      <td>{{ measurement.capturedAt | date: 'short' }}</td>
                      <td>{{ profileLabel(measurement.profile) }}</td>
                      <td>{{ topologyLabel(measurement.topology) }}</td>
                      <td>{{ measurement.activeProjectionCount | number }}</td>
                      <td>{{ measurement.retainedFederatedCount | number }}</td>
                      <td>
                        {{ formatBytes(measurement.applicationPostgresBytes) }}
                      </td>
                      <td>{{ formatBytes(measurement.dspaceStoredBytes) }}</td>
                      <td>{{ formatBytes(measurement.solrIndexBytes) }}</td>
                      <td>
                        {{ formatBytes(measurement.openSearchIndexBytes) }}
                      </td>
                      <td>
                        {{ formatBytes(measurement.totalMeasuredLocalBytes) }}
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          } @else {
            <p>No storage captures have been recorded yet.</p>
          }
        </div>
      } @else {
        @if (loadError$ | async; as error) {
          <p class="warning-message" role="status">{{ error }}</p>
        } @else {
          <p class="inline-status" role="status">
            Loading corpus storage evidence.
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

    .corpus-storage__heading-row,
    .corpus-storage__profile-title,
    .corpus-storage__profile-controls,
    .corpus-storage__activation-row {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 1.5rem;
    }

    .corpus-storage__heading-row > div:first-child {
      max-width: 58rem;
    }

    .corpus-storage__summary,
    .corpus-storage__profile-stats {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
      gap: 0.75rem;
      margin: 1.5rem 0;
    }

    .corpus-storage__summary > div,
    .corpus-storage__profile-stats > div {
      padding: 1rem;
      border: 1px solid var(--civics-border-subtle);
      border-radius: 0.75rem;
      background: var(--mat-sys-surface-container-low);
    }

    dt {
      color: var(--mat-sys-on-surface-variant);
      font-size: 0.78rem;
      font-weight: 700;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }

    dd {
      margin: 0.35rem 0 0;
      font-weight: 650;
    }

    .corpus-storage__profile-controls {
      align-items: center;
      margin: 1.5rem 0 0.75rem;
    }

    mat-form-field {
      min-width: min(100%, 19rem);
    }

    .corpus-storage__profile-note,
    .corpus-storage__activation-row > div {
      display: grid;
      gap: 0.25rem;
      max-width: 42rem;
    }

    .corpus-storage__profile-note span,
    .corpus-storage__activation-row span,
    .corpus-storage__history p {
      color: var(--mat-sys-on-surface-variant);
    }

    .corpus-storage__activation-row {
      align-items: center;
      margin: 0 0 1.5rem;
      padding: 1rem;
      border: 1px solid var(--civics-border-subtle);
      border-radius: 0.75rem;
      background: var(--mat-sys-surface-container-low);
    }

    .corpus-storage__profile-card {
      padding: 1.25rem;
      border: 1px solid var(--civics-border-strong);
      border-radius: 1rem;
      background: var(--mat-sys-surface-container-lowest);
    }

    .corpus-storage__profile-title h3,
    .corpus-storage__history h3 {
      margin-top: 0.2rem;
    }

    .corpus-storage__badge {
      padding: 0.25rem 0.65rem;
      border-radius: 999px;
      background: var(--mat-sys-primary-container);
      color: var(--mat-sys-on-primary-container);
      font-size: 0.8rem;
      font-weight: 700;
    }

    .corpus-storage__badge--planned {
      background: var(--mat-sys-secondary-container);
      color: var(--mat-sys-on-secondary-container);
    }

    .corpus-storage__unmeasured {
      grid-column: 1 / -1;
    }

    .corpus-storage__history {
      margin-top: 1.75rem;
    }

    .corpus-storage__table-scroll {
      overflow-x: auto;
      margin-top: 1rem;
      border: 1px solid var(--civics-border-subtle);
      border-radius: 0.75rem;
    }

    table {
      width: 100%;
      min-width: 70rem;
      border-collapse: collapse;
    }

    th,
    td {
      padding: 0.75rem;
      border-bottom: 1px solid var(--civics-border-subtle);
      text-align: left;
      white-space: nowrap;
    }

    th {
      background: var(--mat-sys-surface-container);
      color: var(--mat-sys-on-surface-variant);
      font-size: 0.78rem;
    }

    tbody tr:last-child td {
      border-bottom: 0;
    }

    code {
      font-size: 0.85em;
    }

    @media (max-width: 720px) {
      .corpus-storage__heading-row,
      .corpus-storage__profile-controls,
      .corpus-storage__profile-title,
      .corpus-storage__activation-row {
        flex-direction: column;
      }

      .corpus-storage__heading-row button,
      .corpus-storage__activation-row button,
      mat-form-field {
        width: 100%;
      }
    }
  `,
})
export class AdminCorpusStorageComponent {
  private readonly adminApi = inject(RepositoryCorpusStorageApi);
  private readonly destroyRef = inject(DestroyRef);
  private readonly refresh$ = new BehaviorSubject(0);
  private readonly selectedProfile$ = new BehaviorSubject<CorpusProfile | null>(
    null,
  );
  private readonly loadErrorSubject = new BehaviorSubject<string | null>(null);
  private readonly captureStatusSubject = new BehaviorSubject<string | null>(
    null,
  );
  private readonly activationStatusSubject = new BehaviorSubject<string | null>(
    null,
  );
  private readonly capturingSubject = new BehaviorSubject(false);
  private readonly activatingSubject = new BehaviorSubject(false);

  protected readonly loadError$ = this.loadErrorSubject.asObservable();
  protected readonly captureStatus$ = this.captureStatusSubject.asObservable();
  protected readonly activationStatus$ =
    this.activationStatusSubject.asObservable();
  protected readonly capturing$ = this.capturingSubject.asObservable();
  protected readonly activating$ = this.activatingSubject.asObservable();

  private readonly overview$ = this.refresh$.pipe(
    switchMap(() => {
      this.loadErrorSubject.next(null);
      return this.adminApi.getCorpusStorageOverview().pipe(
        catchError(() => {
          this.loadErrorSubject.next(
            'Unable to load corpus scale and storage history from the API.',
          );
          return of(null);
        }),
      );
    }),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  protected readonly view$ = combineLatest([
    this.overview$,
    this.selectedProfile$,
  ]).pipe(
    map(([overview, selected]): CorpusStorageView | null => {
      if (!overview) {
        return null;
      }
      const activeProfile =
        overview.profiles.find(
          (profile) => profile.profile === overview.activeProfile,
        ) ?? overview.profiles[0];
      const viewedProfile =
        overview.profiles.find(
          (profile) => profile.profile === (selected ?? overview.activeProfile),
        ) ?? activeProfile;
      if (!activeProfile || !viewedProfile) {
        return null;
      }
      return { overview, activeProfile, viewedProfile };
    }),
  );

  selectProfile(profile: CorpusProfile): void {
    this.selectedProfile$.next(profile);
    this.activationStatusSubject.next(null);
  }

  activateProfile(profile: CorpusProfile): void {
    if (this.activatingSubject.value || this.capturingSubject.value) {
      return;
    }

    this.activatingSubject.next(true);
    this.activationStatusSubject.next(null);
    const label = this.profileLabel(profile);

    this.adminApi
      .activateCorpusProfile(profile)
      .pipe(
        switchMap((projection) =>
          this.adminApi.captureCorpusStorage().pipe(
            map(
              (): ActivationResult => ({
                projection,
                footprintCaptured: true,
              }),
            ),
            catchError(() =>
              of<ActivationResult>({
                projection,
                footprintCaptured: false,
              }),
            ),
          ),
        ),
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.activatingSubject.next(false)),
      )
      .subscribe({
        next: ({ projection, footprintCaptured }) => {
          const captureMessage = footprintCaptured
            ? ' Storage footprint captured.'
            : ' The profile is active, but its storage footprint could not be captured.';
          this.activationStatusSubject.next(
            `${label} activated with ${projection.objectCount.toLocaleString()} searchable documents.${captureMessage}`,
          );
          this.selectedProfile$.next(profile);
          this.refresh$.next(this.refresh$.value + 1);
        },
        error: () => {
          this.activationStatusSubject.next(
            `Unable to activate ${label}. Required retained metadata may be missing, or a search target may be unavailable. The previous active profile was preserved or restored.`,
          );
          this.refresh$.next(this.refresh$.value + 1);
        },
      });
  }

  captureCurrentFootprint(): void {
    if (this.capturingSubject.value || this.activatingSubject.value) {
      return;
    }
    this.capturingSubject.next(true);
    this.captureStatusSubject.next(null);

    this.adminApi
      .captureCorpusStorage()
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.capturingSubject.next(false)),
      )
      .subscribe({
        next: (measurement) => {
          this.captureStatusSubject.next(
            `Current footprint captured for ${this.profileLabel(measurement.profile)}.`,
          );
          this.refresh$.next(this.refresh$.value + 1);
        },
        error: () => {
          this.captureStatusSubject.next(
            'Unable to capture the current corpus storage footprint.',
          );
        },
      });
  }

  protected isHeavyProfile(profile: CorpusProfile): boolean {
    return (
      profile === 'FEDERATED_100K' ||
      profile === 'FEDERATED_1M' ||
      profile === 'FULL'
    );
  }

  protected formatBytes(value: number | null | undefined): string {
    if (value === null || value === undefined) {
      return 'Not measured';
    }
    if (value < 1024) {
      return `${value} B`;
    }

    const units = ['KiB', 'MiB', 'GiB', 'TiB'];
    let amount = value / 1024;
    let unit = units[0];
    for (let index = 1; index < units.length && amount >= 1024; index += 1) {
      amount /= 1024;
      unit = units[index];
    }
    const precision = amount >= 100 ? 0 : amount >= 10 ? 1 : 2;
    return `${amount.toFixed(precision)} ${unit}`;
  }

  protected shortProjectionId(projectionId: string): string {
    return projectionId.length > 12
      ? `${projectionId.slice(0, 12)}…`
      : projectionId;
  }

  protected profileLabel(profile: CorpusProfile): string {
    switch (profile) {
      case 'CURATED_DEMO':
        return 'Curated demo';
      case 'FEDERATED_10K':
        return 'Federated 10K';
      case 'FEDERATED_100K':
        return 'Federated 100K';
      case 'FEDERATED_1M':
        return 'Federated 1M';
      case 'FULL':
        return 'Full source bounds';
    }
  }

  protected topologyLabel(
    topology: CorpusStorageMeasurement['topology'],
  ): string {
    switch (topology) {
      case 'DOCKER_COMPOSE':
        return 'Docker Compose';
      case 'KIND_CLUSTER':
        return 'kind cluster';
      case 'OTHER':
        return 'Other';
    }
  }
}
