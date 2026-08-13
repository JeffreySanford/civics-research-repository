import { describe, expect, it } from 'vitest';
import {
  formatProgramLabel,
  programCountsFromJobs,
  summarizeActionsFromJobs,
} from './admin-viz.utils';

describe('admin-viz.utils', () => {
  it('formats program labels for display', () => {
    expect(formatProgramLabel('TIGER_LINE')).toBe('TIGER LINE');
  });

  it('summarizes sync actions from jobs', () => {
    const summary = summarizeActionsFromJobs([
      {
        id: '00000000-0000-4000-8000-000000000001',
        mode: 'APPLY',
        source: 'TIGER_LINE',
        status: 'APPLIED',
        startedAt: '2026-08-11T19:00:00Z',
        actions: [
          {
            actionType: 'UPSERT_ITEM',
            target: 'Demo item',
            detail: 'Upsert metadata.',
          },
          {
            actionType: 'UPSERT_ITEM',
            target: 'Another item',
            detail: 'Upsert metadata.',
          },
        ],
      },
    ]);

    expect(summary).toEqual([{ actionType: 'UPSERT_ITEM', count: 2 }]);
  });

  it('groups program counts from sync jobs', () => {
    const counts = programCountsFromJobs([
      {
        id: '00000000-0000-4000-8000-000000000001',
        mode: 'APPLY',
        source: 'TIGER_LINE',
        status: 'APPLIED',
        startedAt: '2026-08-11T19:00:00Z',
        actions: [],
      },
      {
        id: '00000000-0000-4000-8000-000000000002',
        mode: 'DRY_RUN',
        source: 'LODES',
        status: 'DRY_RUN_COMPLETE',
        startedAt: '2026-08-11T19:05:00Z',
        actions: [],
      },
    ]);

    expect(counts).toEqual([
      { program: 'LODES', count: 1 },
      { program: 'TIGER_LINE', count: 1 },
    ]);
  });
});
