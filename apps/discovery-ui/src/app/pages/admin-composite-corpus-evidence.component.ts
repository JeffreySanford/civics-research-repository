import { AsyncPipe, DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import {
  RepositoryCompositeCorpusApi,
  type CompositeCorpusManifest,
} from 'repository-api-client';
import { BehaviorSubject, catchError, of, shareReplay } from 'rxjs';

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
          snapshots are composed into one deterministic identity. Capture is an
          explicit Admin API operation; this view is read-only.
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
            @for (manifest of evidence; track manifest.compositionSha256) {
              <article
                class="composite-evidence__manifest"
                [attr.aria-labelledby]="
                  'composition-' + manifest.compositionSha256
                "
              >
                <div class="composite-evidence__manifest-heading">
                  <div>
                    <p class="eyebrow">{{ manifest.corpusProfile }}</p>
                    <h3 [id]="'composition-' + manifest.compositionSha256">
                      {{ manifest.federatedRecordCount | number }} federated
                      records
                    </h3>
                  </div>
                  <span>{{ manifest.capturedAt | date: 'medium' }}</span>
                </div>

                <dl class="composite-evidence__identity">
                  <div>
                    <dt>Composition version</dt>
                    <dd>{{ manifest.compositionVersion }}</dd>
                  </div>
                  <div>
                    <dt>Composition SHA-256</dt>
                    <dd>
                      <code [title]="manifest.compositionSha256">
                        {{ shortSha(manifest.compositionSha256) }}
                      </code>
                    </dd>
                  </div>
                  <div>
                    <dt>Mode</dt>
                    <dd>{{ manifest.mode }}</dd>
                  </div>
                </dl>

                <div class="composite-evidence__table-wrap">
                  <table>
                    <caption>
                      Bounded source evidence for composition
                      {{ shortSha(manifest.compositionSha256) }}
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
                        source of manifest.sources;
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
                          <td><code>{{ source.runId }}</code></td>
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
        Search projection identity is intentionally separate from composition
        identity. Projection linkage to <code>compositionSha256</code> belongs to
        the next delivery slice.
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
    .composite-evidence__manifest {
      margin-top: 1.25rem;
      padding: 1rem;
      border: 1px solid var(--civics-border-subtle);
      border-radius: 0.75rem;
      background: var(--mat-sys-surface-container-low);
    }

    .composite-evidence__empty p,
    .composite-evidence__boundary,
    .composite-evidence__manifest-heading > span {
      color: var(--mat-sys-on-surface-variant);
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

  protected readonly evidence$ = this.api
    .getRecentCompositeCorpusEvidence('FEDERATED_1M', 20)
    .pipe(
      catchError(() => {
        this.loadError$.next('Composite corpus evidence could not be loaded.');
        return of<readonly CompositeCorpusManifest[] | null>(null);
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
