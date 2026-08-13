import { AsyncPipe, DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { Store } from '@ngrx/store';
import type { SyncSource } from 'repository-api-client';
import { SyncActions } from '../state/sync/sync.actions';
import {
  selectDiscoveryProjection,
  selectReindexing,
  selectSelectedSyncJob,
  selectSelectedSyncSource,
  selectSyncError,
  selectSyncJobs,
  selectSyncLoading,
} from '../state/sync/sync.selectors';

const SYNC_SOURCES: readonly SyncSource[] = [
  'TIGER_LINE',
  'LODES',
  'ACS_PUMS',
  'SIPP',
  'CPS',
  'USGS_EARTHQUAKES',
];

@Component({
  selector: 'app-admin-sync-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AsyncPipe,
    DatePipe,
    MatButtonModule,
    MatFormFieldModule,
    MatProgressSpinnerModule,
    MatSelectModule,
  ],
  templateUrl: './admin-sync-page.html',
})
export class AdminSyncPage implements OnInit {
  private readonly store = inject(Store);

  protected readonly jobs$ = this.store.select(selectSyncJobs);
  protected readonly selectedJob$ = this.store.select(selectSelectedSyncJob);
  protected readonly loading$ = this.store.select(selectSyncLoading);
  protected readonly reindexing$ = this.store.select(selectReindexing);
  protected readonly error$ = this.store.select(selectSyncError);
  protected readonly selectedSource$ = this.store.select(
    selectSelectedSyncSource,
  );
  protected readonly projection$ = this.store.select(selectDiscoveryProjection);
  protected readonly syncSources = SYNC_SOURCES;

  ngOnInit(): void {
    this.store.dispatch(SyncActions.historyRequested());
  }

  protected requestDryRun(): void {
    this.store.dispatch(SyncActions.dryRunRequested());
  }

  protected requestDiff(): void {
    this.store.dispatch(SyncActions.diffRequested());
  }

  protected requestApply(): void {
    this.store.dispatch(SyncActions.applyRequested());
  }

  protected requestReindex(): void {
    this.store.dispatch(SyncActions.reindexRequested());
  }

  protected selectJob(jobId: string): void {
    this.store.dispatch(SyncActions.jobSelected({ jobId }));
  }

  protected selectSource(source: SyncSource): void {
    this.store.dispatch(SyncActions.sourceSelected({ source }));
  }
}
