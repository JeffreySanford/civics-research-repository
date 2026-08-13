import { EvidenceActions } from './evidence.actions';
import { evidenceReducer, initialEvidenceState } from './evidence.reducer';

describe('evidenceReducer', () => {
  it('marks loading when evidence is requested', () => {
    const state = evidenceReducer(
      initialEvidenceState,
      EvidenceActions.loadRequested(),
    );

    expect(state.loading).toBe(true);
    expect(state.error).toBeNull();
  });

  it('stores evidence entries on success', () => {
    const entries = [
      {
        id: 'axe-wcag-2026-08-12',
        workflow: 'axe-core scans (6 routes)',
        status: 'AUTOMATED_PASS' as const,
        standard: 'WCAG_2_1_AA' as const,
        capturedAt: '2026-08-12T00:00:00Z',
      },
    ];

    const state = evidenceReducer(
      evidenceReducer(initialEvidenceState, EvidenceActions.loadRequested()),
      EvidenceActions.loadSucceeded({ entries }),
    );

    expect(state.entries).toEqual(entries);
    expect(state.loading).toBe(false);
    expect(state.error).toBeNull();
  });

  it('records an error when loading fails', () => {
    const state = evidenceReducer(
      evidenceReducer(initialEvidenceState, EvidenceActions.loadRequested()),
      EvidenceActions.loadFailed({
        error: { code: 'SERVICE_UNAVAILABLE', message: 'Unavailable.' },
      }),
    );

    expect(state.loading).toBe(false);
    expect(state.error).toBe('Unavailable.');
  });
});
