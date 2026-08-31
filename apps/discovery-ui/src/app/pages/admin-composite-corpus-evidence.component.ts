import { AsyncPipe, DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import {
  RepositoryCompositeCorpusApi,
  type CompositeCorpusManifest,
  type CompositeCorpusProjectionEvidence,
} from 'repository-api-client';
import {
  BehaviorSubject,
  catchError,
  combineLatest,
  map,
  of,
  shareReplay,
} from 'rxjs';

interface CompositeCorpusEvidenceView {
  readonly manifest: CompositeCorpusManifest;
  readonly projection: CompositeCorpusProjectionEvidence | null;
  readonly projectionHistoryAvailable: boolean;
}

@Component({
  selector: 'app-admin-composite-corpus-evidence',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AsyncPipe, DatePipe, DecimalPipe],
  template: `
    <section
      class="composite-evidence"
      aria-labelledby="composite-corpus-evidence-heading"
    >
      <div class="composite-evidence__heading">
        <p class="eyebrow">Composition evidence</p>
        <h2 id="composite-corpus-evidence-heading">
          Composite corpus identity
        </h2>
        <p>
          A mixed-source corpus becomes evidence only after exact bounded source
          snapshots are composed into one deterministic identity. Search
          projection evidence is linked separately after those exact source
          quotas are rebuilt with target parity. This view is read-only.
        </p>
      </div>

      @if (evidence$ | async; as evidence) {
        @if (evidence.length === 0) {
          <div class="composite-evidence__empty" role="status">
            <strong>No composite corpus evidence captured yet.</strong>
            <p>
              The planned <code>FEDERATED_1M</code> recipe requires an exact
              500,000-record Data.gov bounded snapshot and an exact
              500,000-record DOE OSTI bounded snapshot before a composition can
              be captured.
            </p>
          </div>
        } @else {
          <div class="composite-evidence__history">
            @for (item of evidence; track item.manifest.compositionSha256) {
              <article
                class="composite-evidence__manifest"
                [attr.aria-labelledby]="
                  'composition-' + item.manifest.compositionSha256
                "
              >
                <div class="composite-evidence__manifest-heading">
                  <div>
                    <p class="eyebrow">{{ item.manifest.corpusProfile }}</p>
                    <h3 [id]="'composition-' + item.manifest.compositionSha256">
                      {{ item.manifest.federatedRecordCount | number }}
                      federated records
                    </h3>
                  </div>
                  <span>{{ item.manifest.capturedAt | date: 'medium' }}</span>
                </div>

                <dl class="composite-evidence__identity">
                  <div>
                    <dt>Composition version</dt>
                    <dd>{{ item.manifest.compositionVersion }}</dd>
                  </div>
                  <div>
                    <dt>Composition SHA-256</dt>
                    <dd>
                      <code [title]="item.manifest.compositionSha256">
                        {{ shortSha(item.manifest.compositionSha256) }}
                      </code>
                    </dd>
                  </div>
                  <div>
                    <dt>Mode</dt>
                    <dd>{{ item.manifest.mode }}</dd>
                  </div>
                </dl>

                @if (!item.projectionHistoryAvailable) {
                  <div
                    class="composite-evidence__projection composite-evidence__projection--warning"
                    role="status"
                  >
                    <strong
                      >Projection linkage evidence could not be loaded.</strong
                    >
                    <p>
                      No claim is made about whether this composition has been
                      projected. The composition identity above remains valid.
                    </p>
                  </div>
                } @else if (item.projection; as projection) {
                  <div
                    class="composite-evidence__projection"
                    aria-label="Search projection linkage"
                  >
                    <p class="eyebrow">Search projection linked</p>
                    <dl class="composite-evidence__identity">
                      <div>
                        <dt>Projection SHA-256</dt>
                        <dd>
                          <code [title]="projection.projectionId">
                            {{ shortSha(projection.projectionId) }}
                          </code>
                        </dd>
                      </div>
                      <div>
                        <dt>Full projected objects</dt>
                        <dd>{{ projection.projectionObjectCount | number }}</dd>
                      </div>
                      <div>
                        <dt>Curated repository slice</dt>
                        <dd>
                          {{ curatedProjectionCount(projection) | number }}
                        </dd>
                      </div>
                      <div>
                        <dt>Projection source</dt>
                        <dd>{{ projection.projectionSource }}</dd>
                      </div>
                      <div>
                        <dt>Projection rebuilt</dt>
                        <dd>
                          {{ projection.projectionRebuiltAt | date: 'medium' }}
                        </dd>
                      </div>
                      <div>
                        <dt>Evidence linked</dt>
                        <dd>{{ projection.linkedAt | date: 'medium' }}</dd>
                      </div>
                    </dl>
                    <p class="composite-evidence__projection-note">
                      The composition controls
                      {{ projection.federatedRecordCount | number }} federated
                      records. The projection identity covers those records plus
                      the curated DSpace repository slice shown above.
                    </p>
                  </div>
                } @else {
                  <div class="composite-evidence__projection" role="status">
                    <strong
                      >Composition captured; search projection not linked
                      yet.</strong
                    >
                    <p>
                      No projection evidence has been recorded for this exact
                      composition SHA. A profile name or document count alone is
                      not treated as projection evidence.
                    </p>
                  </div>
                }

                <div class="composite-evidence__table-wrap">
                  <table>
                    <caption>
                      Bounded source evidence for composition
                      {{
                        shortSha(item.manifest.compositionSha256)
                      }}
                    </caption>
                    <thead>
                      <tr>
                        <th scope="col">Source</th>
                        <th scope="col">Exact quota</th>
                        <th scope="col">Bounded snapshot</th>
                        <th scope="col">Harvest run</th>
                        <th scope="col">Adapter</th>
                        <th scope="col">Snapshot captured</th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (
                        source of item.manifest.sources;
                        track source.sourceSystem
                      ) {
                        <tr>
                          <th scope="row">
                            {{ sourceLabel(source.sourceSystem) }}
                          </th>
                          <td>{{ source.requestedRecordCount | number }}</td>
                          <td>
                            <code [title]="source.snapshotId">
                              {{ shortSnapshotId(source.snapshotId) }}
                            </code>
                          </td>
                          <td>
                            <code>{{ source.runId }}</code>
                          </td>
                          <td>{{ source.runAdapterVersion }}</td>
                          <td>
                            {{ source.snapshotCapturedAt | date: 'medium' }}
                          </td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              </article>
            }
          </div>
        }
      } @else if (loadError$ | async; as error) {
        <p class="warning-message" role="status">{{ error }}</p>
      } @else {
        <p class="inline-status" role="status">
          Loading composite corpus evidence.
        </p>
      }

      <p class="composite-evidence__boundary">
        Composition identity covers the exact federated input. Projection
        identity covers the derived Solr/OpenSearch document set, including the
        curated DSpace slice, and is linked only after source stability and
        target parity succeed.
      </p>
    </section>
  `,
  styles: `
    :host {
      display: block;
      margin-top: 2rem;
      padding-top: 2rem;
      border-top: 1px solid var(--civics-border-subtle);
    }

    .composite-evidence__heading {
      max-width: 58rem;
    }

    .composite-evidence__empty,
    .composite-evidence__manifest,
    .composite-evidence__projection {
      margin-top: 1.25rem;
      padding: 1rem;
      border: 1px solid var(--civics-border-subtle);
      border-radius: 0.75rem;
      background: var(--mat-sys-surface-container-low);
    }

    .composite-evidence__projection {
      background: var(--mat-sys-surface-container);
    }

    .composite-evidence__projection--warning {
      border-style: dashed;
    }

    .composite-evidence__empty p,
    .composite-evidence__boundary,
    .composite-evidence__manifest-heading > span,
    .composite-evidence__projection p {
      color: var(--mat-sys-on-surface-variant);
    }

    .composite-evidence__projection-note {
      margin-bottom: 0;
      font-size: 0.9rem;
    }

    .composite-evidence__history {
      display: grid;
      gap: 1rem;
    }

    .composite-evidence__manifest-heading {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 1rem;
    }

    .composite-evidence__manifest-heading h3 {
      margin-top: 0.25rem;
    }

    .composite-evidence__identity {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
      gap: 0.75rem;
      margin: 1rem 0;
    }

    .composite-evidence__identity > div {
      min-width: 0;
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
      overflow-wrap: anywhere;
      font-weight: 650;
    }

    .composite-evidence__table-wrap {
      margin-top: 1rem;
      overflow-x: auto;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.9rem;
    }

    caption {
      padding: 0 0 0.75rem;
      text-align: left;
      font-weight: 700;
    }

    th,
    td {
      padding: 0.7rem;
      border-bottom: 1px solid var(--civics-border-subtle);
      text-align: left;
      vertical-align: top;
    }

    thead th {
      color: var(--mat-sys-on-surface-variant);
      font-size: 0.78rem;
      text-transform: uppercase;
    }

    code {
      overflow-wrap: anywhere;
    }

    .composite-evidence__boundary {
      margin-top: 1rem;
      font-size: 0.9rem;
    }

    @media (max-width: 48rem) {
      .composite-evidence__manifest-heading {
        display: grid;
      }
    }
  `,
})
export class AdminCompositeCorpusEvidenceComponent {
  private readonly api = inject(RepositoryCompositeCorpusApi);
  protected readonly loadError$ = new BehaviorSubject<string | null>(null);

  private readonly manifests$ = this.api
    .getRecentCompositeCorpusEvidence('FEDERATED_1M', 20)
    .pipe(
      catchError(() => {
        this.loadError$.next('Composite corpus evidence could not be loaded.');
        return of<readonly CompositeCorpusManifest[] | null>(null);
      }),
    );

  private readonly projections$ = this.api
    .getRecentCompositeCorpusProjectionEvidence('FEDERATED_1M', 20)
    .pipe(
      catchError(() =>
        of<readonly CompositeCorpusProjectionEvidence[] | null>(null),
      ),
    );

  protected readonly evidence$ = combineLatest([
    this.manifests$,
    this.projections$,
  ]).pipe(
    map(([manifests, projections]) => {
      if (manifests === null) {
        return null;
      }
      const projectionHistoryAvailable = projections !== null;
      return manifests.map<CompositeCorpusEvidenceView>((manifest) => ({
        manifest,
        projection:
          projections?.find(
            (candidate) =>
              candidate.compositionSha256 === manifest.compositionSha256,
          ) ?? null,
        projectionHistoryAvailable,
      }));
    }),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  protected shortSha(value: string): string {
    return `${value.slice(0, 12)}…${value.slice(-8)}`;
  }

  protected shortSnapshotId(value: string): string {
    const separator = value.indexOf(':');
    if (separator < 0) {
      return this.shortSha(value);
    }
    return `${value.slice(0, separator + 1)}${this.shortSha(
      value.slice(separator + 1),
    )}`;
  }

  protected curatedProjectionCount(
    projection: CompositeCorpusProjectionEvidence,
  ): number {
    return Math.max(
      0,
      projection.projectionObjectCount - projection.federatedRecordCount,
    );
  }

  protected sourceLabel(sourceSystem: string): string {
    switch (sourceSystem) {
      case 'DATA_GOV':
        return 'Data.gov';
      case 'DOE_OSTI':
        return 'DOE OSTI';
      case 'NASA_CMR':
        return 'NASA CMR';
      case 'PUBMED':
        return 'PubMed';
      case 'OPENALEX':
        return 'OpenAlex';
      default:
        return sourceSystem;
    }
  }
}
