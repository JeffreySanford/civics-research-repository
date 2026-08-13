import {
  countAutomatedChecks,
  evidenceStatusLabel,
  extractArtifactPath,
  isAutomatedEvidence,
} from './evidence-page.utils';

describe('evidence-page.utils', () => {
  it('identifies automated evidence statuses', () => {
    expect(isAutomatedEvidence('AUTOMATED_PASS')).toBe(true);
    expect(isAutomatedEvidence('NOT_STARTED')).toBe(false);
  });

  it('labels evidence statuses for display', () => {
    expect(evidenceStatusLabel('MANUAL_REVIEW_REQUIRED')).toBe(
      'Manual review required',
    );
  });

  it('extracts artifact paths from notes', () => {
    expect(
      extractArtifactPath(
        '57 checks passed. Artifact: documentation/accessibility-evidence/release-checklists/2026-08-12-automated-baseline.md',
      ),
    ).toBe(
      'documentation/accessibility-evidence/release-checklists/2026-08-12-automated-baseline.md',
    );
  });

  it('sums automated check counts from notes', () => {
    expect(
      countAutomatedChecks([
        {
          id: 'axe',
          workflow: 'axe',
          status: 'AUTOMATED_PASS',
          standard: 'WCAG_2_1_AA',
          capturedAt: '2026-08-12T00:00:00Z',
          notes: '57 checks passed.',
        },
        {
          id: 'storyboard',
          workflow: 'storyboard',
          status: 'AUTOMATED_PASS',
          standard: 'WCAG_2_1_AA',
          capturedAt: '2026-08-12T00:00:00Z',
          notes: '72 end-to-end workflow checks.',
        },
      ]),
    ).toEqual({ passed: 129, failed: 0, total: 129 });
  });
});
