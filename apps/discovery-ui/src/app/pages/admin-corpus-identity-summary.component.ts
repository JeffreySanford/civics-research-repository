import { AsyncPipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import {
  RepositoryCorpusStorageApi,
  type CorpusProfileSummary,
  type CorpusStorageMeasurement,
  type CorpusStorageOverview,
} from 'repository-api-client';
import { catchError, map, of, shareReplay } from 'rxjs';

interface CorpusIdentityView {
  readonly profile: CorpusProfileSummary;
  readonly curatedRepositoryCount: number;
  readonly retainedFederatedCount: number;
  readonly projectedFederatedCount: number;
  readonly retainedOutsideProjection: number;
  readonly activeProjectionCount: number;
}

@Component({
  selector: 'app-admin-corpus-identity-summary',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AsyncPipe, DecimalPipe],
  template: `
    <section class="corpus-identity" aria-labelledby="corpus-identity-heading">
      <div class="corpus-identity__heading">
        <div>
          <p class="eyebrow">Active corpus identity</p>
          <h2 id="corpus-identity-heading">Authority, retention & projection</h2>
        </div>
        <p>
          Changing search profiles selects a deterministic projection. It does
          not delete the larger federated metadata corpus retained in
          application PostgreSQL.
        </p>
      </div>

      @if (view$ | async; as view) {
        <div class="corpus-identity__layers">
          <article>
            <span class="corpus-identity__step">1</span>
            <p class="eyebrow">Repository authority</p>
            <strong>{{ view.curatedRepositoryCount | number }}</strong>
            <span>curated DSpace records</span>
          </article>
          <span class="corpus-identity__arrow" aria-hidden="true">→</span>
          <article>
            <span class="corpus-identity__step">2</span>
            <p class="eyebrow">Federated retention</p>
            <strong>{{ view.retainedFederatedCount | number }}</strong>
            <span>metadata records in application PostgreSQL</span>
          </article>
          <span class="corpus-identity__arrow" aria-hidden="true">→</span>
          <article>
            <span class="corpus-identity__step">3</span>
            <p class="eyebrow">Search projection</p>
            <strong>{{ view.activeProjectionCount | number }}</strong>
            <span>documents in both Solr and OpenSearch</span>
          </article>
        </div>

        <dl class="corpus-identity__active">
          <div>
            <dt>Active profile</dt>
            <dd>{{ view.profile.label }}</dd>
          </div>
          <div>
            <dt>Projected federated slice</dt>
            <dd>{{ view.projectedFederatedCount | number }}</dd>
          </div>
          <div>
            <dt>Retained but not projected</dt>
            <dd>{{ view.retainedOutsideProjection | number }}</dd>
          </div>
        </dl>

        @if (view.profile.profile === 'FEDERATED_1M') {
          <div class="corpus-identity__c2">
            <strong>C2 exact composite</strong>
            <span>500,000 Data.gov + 500,000 DOE OSTI</span>
            <span>
              1,000,000 federated + {{ view.curatedRepositoryCount | number }}
              curated = {{ view.activeProjectionCount | number }} searchable
              documents
            </span>
          </div>
        }
      } @else {
        <p class="inline-status" role="status">
          Corpus identity will appear after storage evidence is available for
          the active profile.
        </p>
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

    .corpus-identity__heading {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 2rem;
    }

    .corpus-identity__heading > p {
      max-width: 42rem;
      margin-top: 0;
      color: var(--mat-sys-on-surface-variant);
    }

    .corpus-identity__layers {
      display: grid;
      grid-template-columns: 1fr auto 1fr auto 1fr;
      align-items: stretch;
      gap: 0.75rem;
      margin-top: 1.5rem;
    }

    .corpus-identity__layers article {
      position: relative;
      display: grid;
      align-content: start;
      gap: 0.3rem;
      padding: 1rem;
      border: 1px solid var(--civics-border-strong);
      border-radius: 0.85rem;
      background: var(--mat-sys-surface-container-low);
    }

    .corpus-identity__layers strong {
      font-size: clamp(1.5rem, 3vw, 2.25rem);
      font-variant-numeric: tabular-nums;
    }

    .corpus-identity__layers article > span:last-child,
    .corpus-identity__active dt,
    .corpus-identity__c2 span {
      color: var(--mat-sys-on-surface-variant);
    }

    .corpus-identity__step {
      position: absolute;
      top: 0.75rem;
      right: 0.75rem;
      display: grid;
      width: 1.6rem;
      height: 1.6rem;
      place-items: center;
      border-radius: 999px;
      background: var(--mat-sys-primary-container);
      color: var(--mat-sys-on-primary-container);
      font-size: 0.75rem;
      font-weight: 800;
    }

    .corpus-identity__arrow {
      align-self: center;
      color: var(--mat-sys-primary);
      font-size: 1.4rem;
      font-weight: 800;
    }

    .corpus-identity__active {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 0.75rem;
      margin: 1rem 0 0;
    }

    .corpus-identity__active > div,
    .corpus-identity__c2 {
      padding: 0.85rem 1rem;
      border-radius: 0.75rem;
      background: var(--mat-sys-surface-container);
    }

    .corpus-identity__active dt {
      font-size: 0.75rem;
      font-weight: 750;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }

    .corpus-identity__active dd {
      margin: 0.3rem 0 0;
      font-weight: 700;
    }

    .corpus-identity__c2 {
      display: flex;
      gap: 0.5rem 1rem;
      align-items: baseline;
      flex-wrap: wrap;
      margin-top: 1rem;
      border: 1px solid var(--civics-border-subtle);
    }

    @media (max-width: 760px) {
      .corpus-identity__heading {
        flex-direction: column;
        gap: 0.75rem;
      }

      .corpus-identity__layers {
        grid-template-columns: 1fr;
      }

      .corpus-identity__arrow {
        transform: rotate(90deg);
        justify-self: center;
      }

      .corpus-identity__active {
        grid-template-columns: 1fr;
      }
    }
  `,
})
export class AdminCorpusIdentitySummaryComponent {
  private readonly api = inject(RepositoryCorpusStorageApi);

  protected readonly view$ = this.api.getCorpusStorageOverview().pipe(
    map((overview) => this.toView(overview)),
    catchError(() => of(null)),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  private toView(overview: CorpusStorageOverview): CorpusIdentityView | null {
    const profile = overview.profiles.find(
      (candidate) => candidate.profile === overview.activeProfile,
    );
    const measurement = profile?.latestMeasurement;
    if (!profile || !measurement) {
      return null;
    }

    const retainedFederatedCount = measurement.retainedFederatedCount;
    const activeProjectionCount = measurement.activeProjectionCount;
    const projectedFederatedCount = this.projectedFederatedCount(
      profile,
      measurement,
    );
    return {
      profile,
      retainedFederatedCount,
      activeProjectionCount,
      projectedFederatedCount,
      retainedOutsideProjection: Math.max(
        0,
        retainedFederatedCount - projectedFederatedCount,
      ),
      curatedRepositoryCount: Math.max(
        0,
        activeProjectionCount - projectedFederatedCount,
      ),
    };
  }

  private projectedFederatedCount(
    profile: CorpusProfileSummary,
    measurement: CorpusStorageMeasurement,
  ): number {
    if (profile.profile === 'CURATED_DEMO') {
      return 0;
    }
    return Math.min(
      measurement.retainedFederatedCount,
      profile.targetFederatedRecordCount ?? measurement.retainedFederatedCount,
    );
  }
}
