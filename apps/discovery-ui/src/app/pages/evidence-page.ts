import { AsyncPipe, DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  OnInit,
  inject,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTabsModule } from '@angular/material/tabs';
import { Store } from '@ngrx/store';
import { EvidenceActions } from '../state/evidence/evidence.actions';
import { PipelineActions } from '../state/pipeline/pipeline.actions';
import {
  selectPipelineError,
  selectPipelineLoading,
  selectPipelineStages,
  selectSourceProgramRows,
} from '../state/pipeline/pipeline.selectors';
import {
  selectAutomatedCheckCounts,
  selectAutomatedEvidence,
  selectEvidenceError,
  selectEvidenceLoading,
  selectLatestCapturedAt,
  selectManualEvidence,
  selectOverallAutomatedStatus,
} from '../state/evidence/evidence.selectors';
import { AdminSearchProjectionComponent } from './admin-search-projection.component';
import {
  KNOWN_GAPS,
  MANUAL_CHECKLISTS,
  WCAG_CRITERIA_COVERED,
  buildReportArtifacts,
  evidenceStatusLabel,
  extractArtifactPath,
  indexEvidenceById,
  standardLabel,
} from './evidence-page.utils';

@Component({
  selector: 'app-evidence-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AsyncPipe,
    DatePipe,
    MatProgressSpinnerModule,
    MatTabsModule,
    AdminSearchProjectionComponent,
  ],
  templateUrl: './evidence-page.html',
})
export class EvidencePage implements OnInit {
  private readonly store = inject(Store);
  private readonly destroyRef = inject(DestroyRef);
  private readonly changeDetectorRef = inject(ChangeDetectorRef);

  protected readonly automatedEntries$ = this.store.select(
    selectAutomatedEvidence,
  );
  protected readonly manualEntries$ = this.store.select(selectManualEvidence);
  protected readonly loading$ = this.store.select(selectEvidenceLoading);
  protected readonly stages$ = this.store.select(selectPipelineStages);
  protected readonly programRows$ = this.store.select(selectSourceProgramRows);
  protected readonly pipelineLoading$ = this.store.select(
    selectPipelineLoading,
  );
  protected readonly pipelineError$ = this.store.select(selectPipelineError);
  protected readonly error$ = this.store.select(selectEvidenceError);
  protected readonly checkCounts$ = this.store.select(
    selectAutomatedCheckCounts,
  );
  protected readonly latestCapturedAt$ = this.store.select(
    selectLatestCapturedAt,
  );
  protected readonly overallAutomatedStatus$ = this.store.select(
    selectOverallAutomatedStatus,
  );

  protected readonly manualChecklists = MANUAL_CHECKLISTS;
  protected readonly wcagCriteria = WCAG_CRITERIA_COVERED;
  protected readonly knownGaps = KNOWN_GAPS;
  protected reportArtifacts = buildReportArtifacts([]);

  protected readonly evidenceStatusLabel = evidenceStatusLabel;
  protected readonly standardLabel = standardLabel;
  protected readonly extractArtifactPath = extractArtifactPath;
  protected readonly buildReportArtifacts = buildReportArtifacts;
  protected readonly indexEvidenceById = indexEvidenceById;

  constructor() {
    this.automatedEntries$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((entries) => {
        this.reportArtifacts = buildReportArtifacts(entries);
        this.changeDetectorRef.markForCheck();
      });
  }

  ngOnInit(): void {
    this.store.dispatch(EvidenceActions.loadRequested());
    this.store.dispatch(PipelineActions.loadRequested());
  }

  /**
   * Binary units, because these are file sizes as the publishing host reports them.
   *
   * Rounded to one decimal past a kibibyte: the exact byte count is in the API response for anyone
   * who needs it, and "1.7 GiB" is what a reader actually takes away.
   */
  protected formatBytes(bytes: number): string {
    if (!bytes) {
      return '0 B';
    }

    const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB'];
    const exponent = Math.min(
      Math.floor(Math.log(bytes) / Math.log(1024)),
      units.length - 1,
    );
    const value = bytes / 1024 ** exponent;

    return `${exponent === 0 ? value : value.toFixed(1)} ${units[exponent]}`;
  }

  protected manualChecklistStatus(
    entries: ReturnType<typeof indexEvidenceById>,
    checklistId: string,
  ): string {
    const entry = entries.get(checklistId);
    return entry ? evidenceStatusLabel(entry.status) : 'Not loaded';
  }
}
