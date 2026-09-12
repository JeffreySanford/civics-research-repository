import { AsyncPipe, DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import {
  RepositoryAdminApi,
  RepositoryEvidenceApi,
  type AccessibilityEvidence,
  type DspaceOverview,
  type SearchPerformanceEvidence,
  type SourceInventory,
  type SyncJob,
} from 'repository-api-client';
import { RepositoryCorpusStorageApi } from 'repository-api-client';
import { catchError, map, of, shareReplay } from 'rxjs';
import { AdminSearchProjectionComponent } from './admin-search-projection.component';

interface Loadable<T> {
  readonly data: T | null;
  readonly warning: string | null;
}

function available<T>(data: T): Loadable<T> {
  return { data, warning: null };
}

function unavailable<T>(warning: string): Loadable<T> {
  return { data: null, warning };
}

@Component({
  selector: 'app-repository-steward-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AsyncPipe, DatePipe, DecimalPipe, AdminSearchProjectionComponent],
  template: `
    <div class="page-stack steward-page">
      <section class="hero-panel" aria-labelledby="steward-heading">
        <p class="eyebrow">Repository stewardship</p>
        <h1 id="steward-heading">Read-only repository status</h1>
        <p class="hero-summary">
          A concise operational view of repository authority, corpus identity,
          search projection, source inventory, recent synchronization, and
          retained automated evidence. This surface does not perform sync,
          reindex, harvest, or other privileged mutations.
        </p>
      </section>

      <section class="content-panel" aria-labelledby="authority-heading">
        <p class="eyebrow">Authority boundaries</p>
        <h2 id="authority-heading">Know which system owns each fact</h2>
        <div class="authority-grid">
          <article>
            <h3>Curated research objects</h3>
            <p>
              <strong>DSpace</strong> is authoritative for curated repository
              objects and their repository metadata.
            </p>
          </article>
          <article>
            <h3>Federated source records</h3>
            <p>
              <strong>External publishers</strong> remain authoritative. The
              application retains reproducible metadata and evidence rather than
              claiming ownership of publisher resources.
            </p>
          </article>
          <article>
            <h3>Reproducible application state</h3>
            <p>
              <strong>Application PostgreSQL</strong> retains normalized
              federated metadata, corpus identity, and supporting evidence.
            </p>
          </article>
          <article>
            <h3>Discovery indexes</h3>
            <p>
              <strong>Solr and OpenSearch</strong> are derived projections. They
              can be rebuilt from authoritative/reproducible source state and
              are never treated as systems of record.
            </p>
          </article>
        </div>
      </section>

      <section class="content-panel" aria-labelledby="corpus-heading">
        <p class="eyebrow">Corpus</p>
        <h2 id="corpus-heading">
          Active profile and retained storage evidence
        </h2>

        @if (corpus$ | async; as result) {
          @if (result.data; as corpus) {
            <dl class="status-grid">
              <div>
                <dt>Active profile</dt>
                <dd>{{ corpus.activeProfile }}</dd>
              </div>
              <div>
                <dt>Known profiles</dt>
                <dd>{{ corpus.profiles.length }}</dd>
              </div>
              <div>
                <dt>Storage measurements</dt>
                <dd>{{ corpus.history.length }}</dd>
              </div>
              <div>
                <dt>Latest measurement</dt>
                <dd>
                  @if (corpus.history[0]?.capturedAt; as capturedAt) {
                    {{ capturedAt | date: 'medium' }}
                  } @else {
                    Not recorded
                  }
                </dd>
              </div>
            </dl>
            <p class="context-note">
              Profile identity describes which retained corpus is active. It is
              not a claim that every external publisher is currently reachable.
            </p>
          } @else {
            <p class="warning-message" role="status">{{ result.warning }}</p>
          }
        } @else {
          <p class="inline-status" role="status">Loading corpus status…</p>
        }
      </section>

      <app-admin-search-projection></app-admin-search-projection>

      <section class="content-panel" aria-labelledby="repository-heading">
        <p class="eyebrow">Repository authority</p>
        <h2 id="repository-heading">DSpace availability</h2>

        @if (dspace$ | async; as result) {
          @if (result.data; as dspace) {
            <dl class="status-grid">
              <div>
                <dt>REST reachable</dt>
                <dd>{{ yesNo(dspace.reachable) }}</dd>
              </div>
              <div>
                <dt>Discovery reads configured</dt>
                <dd>{{ yesNo(dspace.readEnabled) }}</dd>
              </div>
              <div>
                <dt>Sync writes configured</dt>
                <dd>{{ yesNo(dspace.writeEnabled) }}</dd>
              </div>
              <div>
                <dt>Visible items</dt>
                <dd>{{ dspace.itemCount ?? 'Unavailable' }}</dd>
              </div>
              <div>
                <dt>Communities</dt>
                <dd>{{ dspace.communityCount ?? 'Unavailable' }}</dd>
              </div>
              <div>
                <dt>Collections</dt>
                <dd>{{ dspace.collectionCount ?? 'Unavailable' }}</dd>
              </div>
            </dl>
            @if (dspace.statusMessage) {
              <p
                [class.warning-message]="!dspace.reachable"
                [class.inline-status]="dspace.reachable"
                role="status"
              >
                {{ dspace.statusMessage }}
              </p>
            }
          } @else {
            <p class="warning-message" role="status">{{ result.warning }}</p>
          }
        } @else {
          <p class="inline-status" role="status">Loading DSpace status…</p>
        }
      </section>

      <section class="content-panel" aria-labelledby="inventory-heading">
        <p class="eyebrow">External sources</p>
        <h2 id="inventory-heading">Measured source inventory</h2>
        <p>
          Inventory values describe the last measurement, not a guarantee about
          publisher availability at this instant.
        </p>

        @if (inventory$ | async; as result) {
          @if (result.data; as inventory) {
            <dl class="status-grid">
              <div>
                <dt>Measured at</dt>
                <dd>{{ inventory.checkedAt | date: 'medium' }}</dd>
              </div>
              <div>
                <dt>Distinct files</dt>
                <dd>{{ inventory.distinctFileCount | number }}</dd>
              </div>
              <div>
                <dt>Measured files</dt>
                <dd>{{ inventory.measuredFileCount | number }}</dd>
              </div>
              <div>
                <dt>Unreachable when measured</dt>
                <dd>{{ inventory.unreachableFileCount | number }}</dd>
              </div>
              <div>
                <dt>Measured bytes</dt>
                <dd>{{ inventory.totalBytes | number }}</dd>
              </div>
              <div>
                <dt>Program groups</dt>
                <dd>{{ inventory.byProgram.length }}</dd>
              </div>
            </dl>
            @if (inventory.unreachableFileCount > 0) {
              <p class="warning-message" role="status">
                {{ inventory.unreachableFileCount }} source files were
                unreachable during the last inventory measurement. The status is
                historical until the inventory is measured again.
              </p>
            }
          } @else {
            <p class="warning-message" role="status">{{ result.warning }}</p>
          }
        } @else {
          <p class="inline-status" role="status">Loading source inventory…</p>
        }
      </section>

      <section class="content-panel" aria-labelledby="sync-heading">
        <p class="eyebrow">Synchronization</p>
        <h2 id="sync-heading">Recent metadata sync history</h2>
        <p>
          This is a read-only history view. Starting or applying synchronization
          remains an Admin Sync responsibility.
        </p>

        @if (syncJobs$ | async; as result) {
          @if (result.data; as jobs) {
            @if (jobs.length > 0) {
              <div
                class="table-scroll"
                tabindex="0"
                aria-label="Recent sync jobs"
              >
                <table>
                  <thead>
                    <tr>
                      <th scope="col">Source</th>
                      <th scope="col">Mode</th>
                      <th scope="col">Status</th>
                      <th scope="col">Started</th>
                      <th scope="col">Completed</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (job of jobs; track job.id) {
                      <tr>
                        <td>{{ job.source }}</td>
                        <td>{{ job.mode }}</td>
                        <td>{{ job.status }}</td>
                        <td>{{ job.startedAt | date: 'short' }}</td>
                        <td>
                          {{
                            job.completedAt
                              ? (job.completedAt | date: 'short')
                              : 'Not completed'
                          }}
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            } @else {
              <p class="empty-message">No synchronization jobs are recorded.</p>
            }
          } @else {
            <p class="warning-message" role="status">{{ result.warning }}</p>
          }
        } @else {
          <p class="inline-status" role="status">Loading sync history…</p>
        }
      </section>

      <section class="content-panel" aria-labelledby="evidence-heading">
        <p class="eyebrow">Automated evidence</p>
        <h2 id="evidence-heading">Retained engineering evidence</h2>
        <p>
          These records summarize automated evidence retained by the repository.
          Accessibility automation is not manual assistive-technology testing or
          a certification claim.
        </p>

        <div class="evidence-grid">
          <article aria-labelledby="accessibility-evidence-heading">
            <h3 id="accessibility-evidence-heading">Accessibility evidence</h3>
            @if (accessibility$ | async; as result) {
              @if (result.data; as evidence) {
                @if (evidence.length > 0) {
                  <dl class="evidence-list">
                    @for (item of evidence; track item.id) {
                      <div>
                        <dt>{{ item.standard }} · {{ item.workflow }}</dt>
                        <dd>
                          {{ item.status }} ·
                          {{ item.capturedAt | date: 'short' }}
                        </dd>
                      </div>
                    }
                  </dl>
                } @else {
                  <p class="empty-message">
                    No retained accessibility evidence is available.
                  </p>
                }
              } @else {
                <p class="warning-message" role="status">
                  {{ result.warning }}
                </p>
              }
            } @else {
              <p class="inline-status" role="status">
                Loading accessibility evidence…
              </p>
            }
          </article>

          <article aria-labelledby="research-evidence-heading">
            <h3 id="research-evidence-heading">Search research evidence</h3>
            @if (searchEvidence$ | async; as result) {
              @if (result.data; as evidence) {
                <dl class="evidence-list">
                  <div>
                    <dt>Profile</dt>
                    <dd>{{ evidence.profile }}</dd>
                  </div>
                  <div>
                    <dt>Scope</dt>
                    <dd>{{ evidence.scope }}</dd>
                  </div>
                  <div>
                    <dt>Captured</dt>
                    <dd>{{ evidence.capturedAt | date: 'medium' }}</dd>
                  </div>
                  <div>
                    <dt>Projection objects</dt>
                    <dd>{{ evidence.projectionObjectCount | number }}</dd>
                  </div>
                </dl>
                <p class="context-note">
                  Search-performance evidence is scoped to the certified local
                  topology and must not be read as a universal engine ranking.
                </p>
              } @else {
                <p class="warning-message" role="status">
                  {{ result.warning }}
                </p>
              }
            } @else {
              <p class="inline-status" role="status">
                Loading search research evidence…
              </p>
            }
          </article>
        </div>
      </section>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .steward-page {
        max-width: 78rem;
        margin: 0 auto;
      }

      .hero-panel,
      .content-panel {
        padding: clamp(1rem, 3vw, 1.75rem);
      }

      .hero-summary,
      .content-panel > p {
        max-width: 72ch;
      }

      .authority-grid,
      .evidence-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(min(100%, 16rem), 1fr));
        gap: 1rem;
      }

      .authority-grid article,
      .evidence-grid article {
        border: 1px solid var(--civics-border);
        border-radius: 0.75rem;
        padding: 1rem;
      }

      .authority-grid h3,
      .evidence-grid h3 {
        margin-top: 0;
      }

      .status-grid,
      .evidence-list {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(min(100%, 13rem), 1fr));
        gap: 0.75rem;
        margin: 1rem 0;
      }

      .status-grid > div,
      .evidence-list > div {
        border: 1px solid var(--civics-border);
        border-radius: 0.5rem;
        padding: 0.8rem;
        min-width: 0;
      }

      dt {
        font-weight: 700;
      }

      dd {
        margin: 0.35rem 0 0;
        overflow-wrap: anywhere;
      }

      .table-scroll {
        overflow-x: auto;
        margin-top: 1rem;
      }

      table {
        width: 100%;
        border-collapse: collapse;
        min-width: 42rem;
      }

      th,
      td {
        border-bottom: 1px solid var(--civics-border);
        padding: 0.65rem;
        text-align: left;
        vertical-align: top;
      }

      .context-note,
      .empty-message {
        color: var(--civics-muted);
      }

      @media (forced-colors: active) {
        .authority-grid article,
        .evidence-grid article,
        .status-grid > div,
        .evidence-list > div,
        th,
        td {
          border-color: CanvasText;
        }
      }
    `,
  ],
})
export class RepositoryStewardPage {
  private readonly adminApi = inject(RepositoryAdminApi);
  private readonly corpusApi = inject(RepositoryCorpusStorageApi);
  private readonly evidenceApi = inject(RepositoryEvidenceApi);

  protected readonly corpus$ = this.load(
    this.corpusApi.getCorpusStorageOverview(),
    'Corpus profile and storage evidence are unavailable.',
  );

  protected readonly dspace$ = this.load<DspaceOverview>(
    this.adminApi.getDspaceOverview(),
    'DSpace status is unavailable from the repository API.',
  );

  protected readonly inventory$ = this.load<SourceInventory>(
    this.adminApi.getSourceInventory(),
    'Source inventory is unavailable from the repository API.',
  );

  protected readonly syncJobs$ = this.load<SyncJob[]>(
    this.adminApi.listSyncJobs().pipe(map((jobs) => jobs.slice(0, 5))),
    'Recent synchronization history is unavailable.',
  );

  protected readonly accessibility$ = this.load<AccessibilityEvidence[]>(
    this.evidenceApi.listAccessibilityEvidence(),
    'Retained accessibility evidence is unavailable.',
  );

  protected readonly searchEvidence$ = this.load<SearchPerformanceEvidence>(
    this.evidenceApi.getSearchPerformanceEvidence(),
    'Certified search research evidence is unavailable.',
  );

  protected yesNo(value: boolean): string {
    return value ? 'Yes' : 'No';
  }

  private load<T>(source: import('rxjs').Observable<T>, warning: string) {
    return source.pipe(
      map((data) => available(data)),
      catchError(() => of(unavailable<T>(warning))),
      shareReplay({ bufferSize: 1, refCount: true }),
    );
  }
}
