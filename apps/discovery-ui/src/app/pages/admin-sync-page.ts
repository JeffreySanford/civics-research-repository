import { AsyncPipe, DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Store } from '@ngrx/store';
import { SyncActions } from '../state/sync/sync.actions';
import {
  selectSelectedSyncJob,
  selectSyncError,
  selectSyncJobs,
  selectSyncLoading,
} from '../state/sync/sync.selectors';

@Component({
  selector: 'app-admin-sync-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AsyncPipe, DatePipe, MatButtonModule, MatProgressSpinnerModule],
  templateUrl: './admin-sync-page.html',
})
export class AdminSyncPage implements OnInit {
  private readonly store = inject(Store);

  protected readonly jobs$ = this.store.select(selectSyncJobs);
  protected readonly selectedJob$ = this.store.select(selectSelectedSyncJob);
  protected readonly loading$ = this.store.select(selectSyncLoading);
  protected readonly error$ = this.store.select(selectSyncError);

  ngOnInit(): void {
    this.store.dispatch(SyncActions.historyRequested());
  }

  protected requestDryRun(): void {
    this.store.dispatch(SyncActions.dryRunRequested());
  }

  protected requestApply(): void {
    this.store.dispatch(SyncActions.applyRequested());
  }

  protected selectJob(jobId: string): void {
    this.store.dispatch(SyncActions.jobSelected({ jobId }));
  }
}
