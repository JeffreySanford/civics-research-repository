import type {
  ProgramCount,
  SyncActionSummary,
  SyncJob,
} from 'repository-api-client';

export interface BarChartItem {
  readonly label: string;
  readonly value: number;
  readonly detail?: string;
}

export interface DonutSegment {
  readonly label: string;
  readonly value: number;
  readonly color: string;
}

export interface FlowStep {
  readonly label: string;
  readonly count?: number | null;
  readonly detail: string;
}

export function formatProgramLabel(program: string): string {
  return program.replaceAll('_', ' ');
}

export function summarizeActionsFromJobs(
  jobs: readonly SyncJob[],
): SyncActionSummary[] {
  const counts = new Map<string, number>();
  for (const job of jobs) {
    for (const action of job.actions) {
      counts.set(action.actionType, (counts.get(action.actionType) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([actionType, count]) => ({ actionType, count }))
    .sort((left, right) => left.actionType.localeCompare(right.actionType));
}

export function programCountsFromJobs(
  jobs: readonly SyncJob[],
): ProgramCount[] {
  const counts = new Map<string, number>();
  for (const job of jobs) {
    counts.set(job.source, (counts.get(job.source) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([program, count]) => ({
      program: program as ProgramCount['program'],
      count,
    }))
    .sort((left, right) => left.program.localeCompare(right.program));
}

export function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}
