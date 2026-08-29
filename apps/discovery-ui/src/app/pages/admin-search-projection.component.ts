import { AsyncPipe, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import {
  RepositoryAdminApi,
  RepositorySearchComparisonApi,
  type DiscoveryProjectionState,
  type SearchComparisonProjection,
  type SearchEngineComparison,
} from 'repository-api-client';
import { catchError, combineLatest, map, of, shareReplay } from 'rxjs';

interface AdminSearchProjectionView {
  readonly projection: DiscoveryProjectionState | null;
  readonly projectionWarning: string | null;
  readonly comparison: {
    readonly sameProjection: boolean;
    readonly solr: SearchEngineComparison;
    readonly openSearch: SearchEngineComparison;
  } | null;
  readonly comparisonWarning: string | null;
}

function mergeProjectionEvidence(
  adminProjection: DiscoveryProjectionState | null,
  comparisonProjection: SearchComparisonProjection | null,
): DiscoveryProjectionState | null {
  if (!adminProjection) {
    return comparisonProjection;
  }
  if (!comparisonProjection) {
    return adminProjection;
  }

  const sameNormalizedSet =
    adminProjection.source === comparisonProjection.source &&
    adminProjection.objectCount === comparisonProjection.objectCount;

  if (!sameNormalizedSet) {
    return adminProjection;
  }

  return {
    ...adminProjection,
    projectionId:
      adminProjection.projectionId ?? comparisonProjection.projectionId,
    rebuiltAt: adminProjection.rebuiltAt ?? comparisonProjection.rebuiltAt,
  };
}

@Component({
  selector: 'app-admin-search-projection',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AsyncPipe, DatePipe],
  template: `
    @if (view$ | async; as view) {
      <section
        aria-labelledby="search-projection-overview-heading"
        class="content-panel"
      >
        <p class="eyebrow">Search projection</p>
        <h2 id="search-projection-overview-heading">
          Normalize once, project many
        </h2>
        <p>
          DSpace remains the system of record. The repository API normalizes one
          <code>DiscoveryDocument</code> set, fingerprints it, and projects that
          same set into every configured search target. Solr remains the
          browser-facing discovery implementation; OpenSearch is the comparison
          target.
        </p>

        @if (view.projection; as projection) {
          <dl class="admin-viz-stat-cards projection-stats">
            <div class="admin-viz-stat-card admin-viz-card">
              <dt>Projection source</dt>
              <dd>{{ projection.source }}</dd>
            </div>
            <div class="admin-viz-stat-card admin-viz-card">
              <dt>Normalized objects</dt>
              <dd>{{ projection.objectCount }}</dd>
            </div>
            <div class="admin-viz-stat-card admin-viz-card projection-id-card">
              <dt>Projection ID</dt>
              <dd>
                @if (projection.projectionId) {
                  <code [title]="projection.projectionId">
                    {{ shortProjectionId(projection.projectionId) }}
                  </code>
                } @else {
                  Not recorded
                }
              </dd>
            </div>
            <div class="admin-viz-stat-card admin-viz-card">
              <dt>Identity parity</dt>
              <dd>
                @if (view.comparison?.sameProjection) {
                  Verified
                } @else {
                  Not verified
                }
              </dd>
            </div>
          </dl>

          @if (projection.rebuiltAt) {
            <p class="inline-status" role="status">
              Current normalized projection rebuilt
              {{ projection.rebuiltAt | date: 'medium' }}.
            </p>
          }
        } @else {
          <p class="warning-message" role="status">
            Projection metadata is unavailable.
          </p>
        }

        @if (view.projectionWarning) {
          <p class="warning-message" role="status">
            {{ view.projectionWarning }}
          </p>
        }
      </section>

      <section aria-labelledby="search-targets-heading" class="content-panel">
        <h2 id="search-targets-heading">Configured search targets</h2>
        <p>
          This is an operational liveness and projection-parity probe. It does
          not display request timing and is not a performance benchmark.
        </p>

        @if (view.comparison; as comparison) {
          <p class="inline-status" role="status">
            Projection parity
            {{ comparison.sameProjection ? 'verified' : 'not verified' }}.
            Verification requires the current deterministic projection identity
            and expected document count, not count equality alone.
          </p>

          <div class="engine-grid">
            <article aria-labelledby="solr-target-heading" class="engine-card">
              <p class="eyebrow">Public discovery</p>
              <h3 id="solr-target-heading">Solr</h3>
              <dl class="status-grid">
                <div>
                  <dt>Enabled</dt>
                  <dd>{{ yesNo(comparison.solr.enabled) }}</dd>
                </div>
                <div>
                  <dt>Reachable</dt>
                  <dd>{{ yesNo(comparison.solr.reachable) }}</dd>
                </div>
                <div>
                  <dt>Core / index</dt>
                  <dd>{{ comparison.solr.indexName }}</dd>
                </div>
                <div>
                  <dt>Indexed documents</dt>
                  <dd>
                    {{ comparison.solr.indexedDocumentCount ?? 'Unavailable' }}
                  </dd>
                </div>
                <div>
                  <dt>Current projection</dt>
                  <dd>
                    {{
                      currentProjectionLabel(
                        comparison.sameProjection,
                        comparison.solr,
                        view.projection?.projectionId
                      )
                    }}
                  </dd>
                </div>
              </dl>
              @if (comparison.solr.warning) {
                <p class="warning-message" role="status">
                  {{ comparison.solr.warning }}
                </p>
              }
            </article>

            <article
              aria-labelledby="opensearch-target-heading"
              class="engine-card"
            >
              <p class="eyebrow">Comparison target</p>
              <h3 id="opensearch-target-heading">OpenSearch</h3>
              <dl class="status-grid">
                <div>
                  <dt>Enabled</dt>
                  <dd>{{ yesNo(comparison.openSearch.enabled) }}</dd>
                </div>
                <div>
                  <dt>Reachable</dt>
                  <dd>{{ yesNo(comparison.openSearch.reachable) }}</dd>
                </div>
                <div>
                  <dt>Core / index</dt>
                  <dd>{{ comparison.openSearch.indexName }}</dd>
                </div>
                <div>
                  <dt>Indexed documents</dt>
                  <dd>
                    {{
                      comparison.openSearch.indexedDocumentCount ??
                        'Unavailable'
                    }}
                  </dd>
                </div>
                <div>
                  <dt>Current projection</dt>
                  <dd>
                    {{
                      currentProjectionLabel(
                        comparison.sameProjection,
                        comparison.openSearch,
                        view.projection?.projectionId
                      )
                    }}
                  </dd>
                </div>
              </dl>
              @if (comparison.openSearch.warning) {
                <p class="warning-message" role="status">
                  {{ comparison.openSearch.warning }}
                </p>
              }
            </article>
          </div>
        } @else {
          <p class="warning-message" role="status">
            Search-target liveness and parity are unavailable.
          </p>
        }

        @if (view.comparisonWarning) {
          <p class="warning-message" role="status">
            {{ view.comparisonWarning }}
          </p>
        }
      </section>
    }
  `,
  styles: [
    `
      :host {
        display: grid;
        gap: 1.5rem;
      }

      .engine-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(min(100%, 20rem), 1fr));
        gap: 1rem;
        margin-top: 1rem;
      }

      .engine-card {
        padding: 1rem;
        border: 1px solid var(--civics-border);
        border-radius: 0.75rem;
      }

      .engine-card h3 {
        margin-top: 0;
      }

      .projection-id-card code {
        word-break: break-all;
      }
    `,
  ],
})
export class AdminSearchProjectionComponent {
  private readonly adminApi = inject(RepositoryAdminApi);
  private readonly comparisonApi = inject(RepositorySearchComparisonApi);

  protected readonly view$ = combineLatest([
    this.adminApi.getDiscoveryProjectionState().pipe(
      map((projection) => ({ projection, warning: null as string | null })),
      catchError(() =>
        of({
          projection: null,
          warning: 'Unable to load the current discovery projection metadata.',
        }),
      ),
    ),
    this.comparisonApi
      .run({
        scenario: 'FACETED_SEARCH',
        query: '',
        page: 0,
        pageSize: 1,
      })
      .pipe(
        map((comparison) => ({ comparison, warning: null as string | null })),
        catchError(() =>
          of({
            comparison: null,
            warning: 'Unable to probe Solr/OpenSearch projection parity.',
          }),
        ),
      ),
  ]).pipe(
    map(([projectionResult, comparisonResult]): AdminSearchProjectionView => {
      const comparisonProjection =
        comparisonResult.comparison?.projection ?? null;
      return {
        projection: mergeProjectionEvidence(
          projectionResult.projection,
          comparisonProjection,
        ),
        projectionWarning: projectionResult.warning,
        comparison: comparisonResult.comparison
          ? {
              sameProjection: comparisonResult.comparison.sameProjection,
              solr: comparisonResult.comparison.solr,
              openSearch: comparisonResult.comparison.openSearch,
            }
          : null,
        comparisonWarning: comparisonResult.warning,
      };
    }),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  protected shortProjectionId(projectionId: string): string {
    return `${projectionId.slice(0, 12)}…`;
  }

  protected yesNo(value: boolean): string {
    return value ? 'Yes' : 'No';
  }

  protected currentProjectionLabel(
    sameProjection: boolean,
    engine: SearchEngineComparison,
    projectionId?: string,
  ): string {
    if (!engine.enabled) {
      return 'Target disabled';
    }
    if (!engine.reachable) {
      return 'Not reachable';
    }
    if (sameProjection && projectionId) {
      return `Verified ${this.shortProjectionId(projectionId)}`;
    }
    return 'Not verified';
  }
}
