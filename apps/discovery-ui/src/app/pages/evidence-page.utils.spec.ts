import {
  buildReportArtifacts,
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

  it('derives the current automated release record from the live evidence date and commit', () => {
    const artifacts = buildReportArtifacts([
      {
        id: 'axe-wcag-2026-08-20',
        workflow: 'Browser WCAG accessibility suite',
        status: 'AUTOMATED_PASS',
        standard: 'WCAG_2_1_AA',
        capturedAt: '2026-08-20T17:41:51.884Z',
        notes:
          'Automated browser evidence passed. Command: pnpm run e2e:reports. Commit: dfc94166.',
      },
    ]);

    expect(artifacts[0]).toEqual({
      label: 'Current automated release record (2026-08-20)',
      path: 'documentation/accessibility-evidence/release-checklists/2026-08-20-dfc94166-automated.md',
    });
    expect(artifacts[1]).toEqual({
      label: 'Historical automated baseline (2026-08-12)',
      path: 'documentation/accessibility-evidence/release-checklists/2026-08-12-automated-baseline.md',
    });
  });

  it('keeps the historical baseline when the old migrated evidence has no tested commit', () => {
    const artifacts = buildReportArtifacts([
      {
        id: 'axe-wcag-2026-08-12',
        workflow: 'Browser WCAG accessibility suite',
        status: 'AUTOMATED_PASS',
        standard: 'WCAG_2_1_AA',
        capturedAt: '2026-08-12T00:00:00Z',
        notes: 'Automated browser evidence passed. Commit: unknown.',
      },
    ]);

    expect(artifacts[0].label).toBe(
      'Historical automated baseline (2026-08-12)',
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
