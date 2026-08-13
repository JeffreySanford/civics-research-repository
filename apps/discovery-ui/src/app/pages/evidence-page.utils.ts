import type { AccessibilityEvidence, EvidenceStatus } from 'repository-api-client';

export interface ManualChecklistSummary {
  readonly id: string;
  readonly name: string;
  readonly itemCount: number;
  readonly wcagReference: string;
  readonly priorityNote?: string;
}

export interface KnownGap {
  readonly title: string;
  readonly detail: string;
}

export const AUTOMATED_STATUSES: readonly EvidenceStatus[] = [
  'AUTOMATED_PASS',
  'AUTOMATED_FAIL',
];

export const MANUAL_CHECKLISTS: readonly ManualChecklistSummary[] = [
  {
    id: 'keyboard-checklist',
    name: 'Keyboard only',
    itemCount: 31,
    wcagReference: 'K1–K31',
    priorityNote: 'Full mouse-free end-to-end run not recorded',
  },
  {
    id: 'nvda-checklist',
    name: 'NVDA smoke test',
    itemCount: 20,
    wcagReference: 'N1–N20',
  },
  {
    id: 'jaws-checklist',
    name: 'JAWS smoke test',
    itemCount: 8,
    wcagReference: 'J1–J8',
    priorityNote: 'Record N/A with licensing reason if unavailable',
  },
  {
    id: 'map-equivalence',
    name: 'Map equivalence',
    itemCount: 15,
    wcagReference: 'M1–M15',
    priorityNote: 'M12 map-to-list focus is the highest-value open item',
  },
  {
    id: 'cognitive-review',
    name: 'Cognitive and workflow review',
    itemCount: 9,
    wcagReference: 'C1–C9',
  },
];

export const WCAG_CRITERIA_COVERED: readonly string[] = [
  '1.1.1 Non-text content (structural preconditions for map feature list)',
  '1.3.1 Info and relationships (landmarks, headings, tab semantics)',
  '1.4.1 Use of color (facet pressed state, legend text)',
  '1.4.4 Resize text (200% zoom operability on discovery)',
  '1.4.10 Reflow (320px width without horizontal scroll)',
  '2.1.1 Keyboard (controls reachable; no pointer-only gestures asserted structurally)',
  '2.1.2 No keyboard trap (tab order checks)',
  '2.4.1 Bypass blocks (skip link first in tab order)',
  '2.4.2 Page titled (distinct title per route)',
  '2.4.3 Focus order (no positive tabindex)',
  '2.4.4 Link purpose (accessible names, not raw URLs)',
  '2.4.6 Headings and labels (one h1, unbroken outline)',
  '2.4.7 Focus visible (contrast checks on primary routes)',
  '3.3.1 Error identification (sync failure alert)',
  '3.3.2 Labels or instructions (search and form labels)',
  '4.1.2 Name, role, value (tabs, facets, map checkboxes)',
  '4.1.3 Status messages (result counts, selection, sync status)',
];

export const KNOWN_GAPS: readonly KnownGap[] = [
  {
    title: 'axe is not full Section 508 conformance',
    detail:
      'Automated scans detect many WCAG violations but cannot judge screen-reader workflow completion, map equivalence in practice, or focus coherence.',
  },
  {
    title: 'No assistive technology run recorded',
    detail:
      'The August 2026 baseline used Playwright and axe only. NVDA, JAWS, and keyboard-only end-to-end runs remain open.',
  },
  {
    title: 'MapLibre canvas tab stop',
    detail:
      'The canvas is focusable for keyboard pan/zoom. Whether that helps or confuses screen-reader users requires manual Checklist 2 item N16.',
  },
  {
    title: 'Map-to-list selection',
    detail:
      'Implemented but not automatically assertable. Checklist 4 item M12 needs a trusted pointer click.',
  },
  {
    title: 'Forced-colors mode',
    detail:
      'High-contrast Windows mode smoke tests are planned but not implemented.',
  },
];

export const REPORT_ARTIFACTS: readonly { label: string; path: string }[] = [
  {
    label: '2026-08-12 automated baseline',
    path: 'documentation/accessibility-evidence/release-checklists/2026-08-12-automated-baseline.md',
  },
  {
    label: 'Manual checklists',
    path: 'documentation/accessibility-manual-evidence.md',
  },
  {
    label: 'Evidence walkthrough',
    path: 'documentation/demo/accessibility-evidence-walkthrough.md',
  },
  {
    label: 'Playwright HTML report (local, git-ignored)',
    path: 'playwright-report/',
  },
  {
    label: 'Per-test output (local, git-ignored)',
    path: 'test-results/',
  },
];

export function isAutomatedEvidence(status: EvidenceStatus): boolean {
  return AUTOMATED_STATUSES.includes(status);
}

export function evidenceStatusLabel(status: EvidenceStatus): string {
  switch (status) {
    case 'AUTOMATED_PASS':
      return 'Automated pass';
    case 'AUTOMATED_FAIL':
      return 'Automated fail';
    case 'MANUAL_REVIEW_REQUIRED':
      return 'Manual review required';
    case 'VERIFIED':
      return 'Verified';
    case 'NOT_STARTED':
      return 'Not started';
  }
}

export function standardLabel(
  standard: AccessibilityEvidence['standard'],
): string {
  switch (standard) {
    case 'WCAG_2_1_AA':
      return 'WCAG 2.1 AA';
    case 'WCAG_2_2_AA':
      return 'WCAG 2.2 AA';
    case 'SECTION_508':
      return 'Section 508';
  }
}

export function extractArtifactPath(notes?: string): string | null {
  if (!notes) {
    return null;
  }

  const match = notes.match(/Artifact:\s*(\S+)/);
  return match?.[1] ?? null;
}

export function indexEvidenceById(
  entries: readonly AccessibilityEvidence[],
): ReadonlyMap<string, AccessibilityEvidence> {
  return new Map(entries.map((entry) => [entry.id, entry]));
}

export function countAutomatedChecks(
  automatedEntries: readonly AccessibilityEvidence[],
): { passed: number; failed: number; total: number } {
  let passed = 0;
  let failed = 0;

  for (const entry of automatedEntries) {
    const match = entry.notes?.match(/(\d+)\s+(?:[\w-]+\s+)*checks/i);
    if (match) {
      const count = Number(match[1]);
      if (entry.status === 'AUTOMATED_PASS') {
        passed += count;
      } else if (entry.status === 'AUTOMATED_FAIL') {
        failed += count;
      }
    }
  }

  return { passed, failed, total: passed + failed };
}
