import { AsyncPipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import {
  RepositoryAdminApi,
  RepositoryCorpusStorageApi,
  type CorpusProfile,
} from 'repository-api-client';
import { catchError, combineLatest, map, of, shareReplay } from 'rxjs';

interface ActiveCorpusIdentity {
  readonly profile: CorpusProfile;
  readonly label: string;
  readonly objectCount: number;
  readonly projectionId: string | null;
  readonly recipe: string | null;
}

@Component({
  selector: 'app-active-corpus-identity',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AsyncPipe, DecimalPipe],
  template: `
    @if (identity$ | async; as identity) {
      <aside
        class="active-corpus"
        aria-label="Active search corpus"
        data-testid="active-corpus-identity"
      >
        <div>
          <span class="active-corpus__label">Search corpus</span>
          <strong>{{ identity.label }}</strong>
          <span aria-hidden="true">·</span>
          <span>{{ identity.objectCount | number }} documents</span>
        </div>
        @if (identity.recipe) {
          <span class="active-corpus__recipe">{{ identity.recipe }}</span>
        }
        @if (identity.projectionId) {
          <code [title]="identity.projectionId">
            projection {{ shortProjectionId(identity.projectionId) }}
          </code>
        }
      </aside>
    }
  `,
  styles: `
    :host {
      display: block;
      margin-top: 0.9rem;
    }

    .active-corpus {
      display: flex;
      align-items: center;
      gap: 0.75rem 1rem;
      flex-wrap: wrap;
      padding: 0.65rem 0.8rem;
      border: 1px solid var(--civics-border-subtle);
      border-radius: 0.75rem;
      background: var(--mat-sys-surface-container-low);
      color: var(--mat-sys-on-surface-variant);
      font-size: 0.88rem;
    }

    .active-corpus > div {
      display: flex;
      align-items: baseline;
      gap: 0.4rem;
      flex-wrap: wrap;
    }

    .active-corpus strong {
      color: var(--mat-sys-on-surface);
    }

    .active-corpus__label {
      font-size: 0.74rem;
      font-weight: 750;
      letter-spacing: 0.05em;
      text-transform: uppercase;
    }

    .active-corpus__recipe {
      padding: 0.18rem 0.5rem;
      border-radius: 999px;
      background: var(--mat-sys-primary-container);
      color: var(--mat-sys-on-primary-container);
      font-size: 0.8rem;
      font-weight: 700;
    }

    code {
      font-size: 0.8rem;
    }
  `,
})
export class ActiveCorpusIdentityComponent {
  private readonly storageApi = inject(RepositoryCorpusStorageApi);
  private readonly adminApi = inject(RepositoryAdminApi);

  protected readonly identity$ = combineLatest([
    this.storageApi.getCorpusStorageOverview().pipe(catchError(() => of(null))),
    this.adminApi
      .getDiscoveryProjectionState()
      .pipe(catchError(() => of(null))),
  ]).pipe(
    map(([overview, projection]): ActiveCorpusIdentity | null => {
      if (!overview || !projection) {
        return null;
      }

      const active = overview.profiles.find(
        (profile) => profile.profile === overview.activeProfile,
      );
      if (!active) {
        return null;
      }

      return {
        profile: active.profile,
        label: active.label,
        objectCount: projection.objectCount,
        projectionId: projection.projectionId ?? null,
        recipe:
          active.profile === 'FEDERATED_1M'
            ? 'C2 exact · 500K Data.gov + 500K DOE OSTI'
            : null,
      };
    }),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  protected shortProjectionId(projectionId: string): string {
    return projectionId.length > 12
      ? `${projectionId.slice(0, 12)}…`
      : projectionId;
  }
}
