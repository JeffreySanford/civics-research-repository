import { TestBed } from '@angular/core/testing';
import { provideMockActions } from '@ngrx/effects/testing';
import { firstValueFrom, of, throwError, type Observable } from 'rxjs';
import {
  RepositoryEvidenceApi,
  type AccessibilityEvidence,
} from 'repository-api-client';
import { EvidenceActions } from './evidence.actions';
import { EvidenceEffects } from './evidence.effects';

const entries: AccessibilityEvidence[] = [
  {
    id: 'axe-wcag-2026-08-12',
    workflow: 'axe-core scans (6 routes)',
    status: 'AUTOMATED_PASS',
    standard: 'WCAG_2_1_AA',
    capturedAt: '2026-08-12T00:00:00Z',
  },
];

function setup(
  evidenceApi: Partial<RepositoryEvidenceApi>,
  actions$: Observable<unknown>,
) {
  TestBed.configureTestingModule({
    providers: [
      EvidenceEffects,
      provideMockActions(() => actions$),
      { provide: RepositoryEvidenceApi, useValue: evidenceApi },
    ],
  });

  return TestBed.inject(EvidenceEffects);
}

describe('EvidenceEffects', () => {
  it('loads accessibility evidence summaries', async () => {
    const effects = setup(
      {
        listAccessibilityEvidence: vi.fn().mockReturnValue(of(entries)),
      } as unknown as RepositoryEvidenceApi,
      of(EvidenceActions.loadRequested()),
    );

    const emitted = await firstValueFrom(effects.loadEvidence$);

    expect(emitted).toEqual(EvidenceActions.loadSucceeded({ entries }));
  });

  it('reports a load failure with a readable message', async () => {
    const effects = setup(
      {
        listAccessibilityEvidence: vi
          .fn()
          .mockReturnValue(throwError(() => ({ status: 503 }))),
      } as unknown as RepositoryEvidenceApi,
      of(EvidenceActions.loadRequested()),
    );

    const emitted = await firstValueFrom(effects.loadEvidence$);

    expect(emitted).toEqual(
      EvidenceActions.loadFailed({
        error: {
          code: 'SERVICE_UNAVAILABLE',
          message: 'Accessibility evidence failed to load.',
        },
      }),
    );
  });
});
