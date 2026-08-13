import { AsyncPipe, DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
} from '@angular/core';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Store } from '@ngrx/store';
import { EvidenceActions } from '../state/evidence/evidence.actions';
import {
  selectAutomatedCheckCounts,
  selectAutomatedEvidence,
  selectEvidenceError,
  selectEvidenceLoading,
  selectLatestCapturedAt,
  selectManualEvidence,
  selectOverallAutomatedStatus,
} from '../state/evidence/evidence.selectors';
import {
  KNOWN_GAPS,
  MANUAL_CHECKLISTS,
  REPORT_ARTIFACTS,
  WCAG_CRITERIA_COVERED,
  evidenceStatusLabel,
  extractArtifactPath,
  indexEvidenceById,
  standardLabel,
} from './evidence-page.utils';

@Component({
  selector: 'app-evidence-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AsyncPipe, DatePipe, MatProgressSpinnerModule],
  templateUrl: './evidence-page.html',
})
export class EvidencePage implements OnInit {
  private readonly store = inject(Store);

  protected readonly automatedEntries$ = this.store.select(
    selectAutomatedEvidence,
  );
  protected readonly manualEntries$ = this.store.select(selectManualEvidence);
  protected readonly loading$ = this.store.select(selectEvidenceLoading);
  protected readonly error$ = this.store.select(selectEvidenceError);
  protected readonly checkCounts$ = this.store.select(selectAutomatedCheckCounts);
  protected readonly latestCapturedAt$ = this.store.select(
    selectLatestCapturedAt,
  );
  protected readonly overallAutomatedStatus$ = this.store.select(
    selectOverallAutomatedStatus,
  );

  protected readonly manualChecklists = MANUAL_CHECKLISTS;
  protected readonly wcagCriteria = WCAG_CRITERIA_COVERED;
  protected readonly knownGaps = KNOWN_GAPS;
  protected readonly reportArtifacts = REPORT_ARTIFACTS;

  protected readonly evidenceStatusLabel = evidenceStatusLabel;
  protected readonly standardLabel = standardLabel;
  protected readonly extractArtifactPath = extractArtifactPath;
  protected readonly indexEvidenceById = indexEvidenceById;

  ngOnInit(): void {
    this.store.dispatch(EvidenceActions.loadRequested());
  }

  protected manualChecklistStatus(
    entries: ReturnType<typeof indexEvidenceById>,
    checklistId: string,
  ): string {
    const entry = entries.get(checklistId);
    return entry ? evidenceStatusLabel(entry.status) : 'Not loaded';
  }
}
