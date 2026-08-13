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
import { MatTabsModule } from '@angular/material/tabs';
import { Store } from '@ngrx/store';
import {
  RepositoryAdminApi,
  type DspaceOverview,
  type SolrOverview,
  type SyncSource,
} from 'repository-api-client';
import { catchError, of, shareReplay } from 'rxjs';
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

const UNAVAILABLE_DSPACE_OVERVIEW: DspaceOverview = {
  reachable: false,
  readEnabled: false,
  writeEnabled: false,
  statusMessage: 'Unable to load DSpace overview from the API.',
};

const UNAVAILABLE_SOLR_OVERVIEW: SolrOverview = {
  enabled: false,
  reachable: false,
  statusMessage: 'Unable to load Solr overview from the API.',
};

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
    MatTabsModule,
  ],
  styleUrl: './admin-sync-page.scss',
  templateUrl: './admin-sync-page.html',
})
export class AdminSyncPage implements OnInit {
  private readonly store = inject(Store);
  private readonly adminApi = inject(RepositoryAdminApi);

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

  protected readonly dspaceOverview$ = this.adminApi.getDspaceOverview().pipe(
    catchError(() => of(UNAVAILABLE_DSPACE_OVERVIEW)),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  protected readonly solrOverview$ = this.adminApi.getSolrOverview().pipe(
    catchError(() => of(UNAVAILABLE_SOLR_OVERVIEW)),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

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
