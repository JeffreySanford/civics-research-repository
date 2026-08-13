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
import {
  catchError,
  combineLatest,
  map,
  of,
  shareReplay,
  startWith,
} from 'rxjs';
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
import { AnimatedCounterComponent } from './admin-viz/animated-counter.component';
import { AdminBarChartComponent } from './admin-viz/bar-chart.component';
import { AdminDonutChartComponent } from './admin-viz/donut-chart.component';
import { AdminFlowDiagramComponent } from './admin-viz/flow-diagram.component';
import {
  adminCardStagger,
  adminPanelEnter,
} from './admin-viz/admin-viz.animations';
import {
  AdminSyncPipelineComponent,
  type PipelineStage,
} from './admin-viz/sync-pipeline.component';
import {
  formatProgramLabel,
  type BarChartItem,
  type DonutSegment,
  type FlowStep,
  programCountsFromJobs,
  summarizeActionsFromJobs,
} from './admin-viz/admin-viz.utils';

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
  animations: [adminPanelEnter, adminCardStagger],
  imports: [
    AsyncPipe,
    DatePipe,
    MatButtonModule,
    MatFormFieldModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    MatTabsModule,
    AnimatedCounterComponent,
    AdminBarChartComponent,
    AdminDonutChartComponent,
    AdminFlowDiagramComponent,
    AdminSyncPipelineComponent,
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
  protected readonly formatProgramLabel = formatProgramLabel;

  protected readonly dspaceOverview$ = this.adminApi.getDspaceOverview().pipe(
    catchError(() => of(UNAVAILABLE_DSPACE_OVERVIEW)),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  protected readonly solrOverview$ = this.adminApi.getSolrOverview().pipe(
    catchError(() => of(UNAVAILABLE_SOLR_OVERVIEW)),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  protected readonly pipelineStage$ = combineLatest([
    this.loading$.pipe(startWith(false)),
    this.reindexing$.pipe(startWith(false)),
  ]).pipe(
    map(([loading, reindexing]): PipelineStage => {
      if (reindexing) {
        return 'solr';
      }
      if (loading) {
        return 'api';
      }
      return 'idle';
    }),
  );

  protected readonly actionSummary$ = combineLatest([
    this.dspaceOverview$,
    this.jobs$,
  ]).pipe(
    map(([overview, jobs]) => {
      if (overview.recentSyncActionSummary?.length) {
        return overview.recentSyncActionSummary.map(
          (summary): BarChartItem => ({
            label: summary.actionType.replaceAll('_', ' '),
            value: summary.count,
          }),
        );
      }
      return summarizeActionsFromJobs(jobs).map(
        (summary): BarChartItem => ({
          label: summary.actionType.replaceAll('_', ' '),
          value: summary.count,
        }),
      );
    }),
  );

  protected readonly programBarItems$ = combineLatest([
    this.dspaceOverview$,
    this.jobs$,
  ]).pipe(
    map(([overview, jobs]) => {
      const counts = overview.programCounts?.length
        ? overview.programCounts
        : programCountsFromJobs(jobs);
      return counts.map(
        (entry): BarChartItem => ({
          label: formatProgramLabel(entry.program),
          value: entry.count,
        }),
      );
    }),
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

  protected dspaceFlowSteps(overview: DspaceOverview): readonly FlowStep[] {
    return [
      {
        label: 'Catalog',
        detail: 'Public metadata adapters harvest publisher slices.',
      },
      {
        label: 'SAF seed',
        detail: 'pnpm run dspace:seed imports structure idempotently.',
      },
      {
        label: 'Community',
        count: overview.communityCount,
        detail: 'Top-level Census Public Research Data grouping.',
      },
      {
        label: 'Collection',
        count: overview.collectionCount,
        detail: 'Curated program collections inside the community.',
      },
      {
        label: 'Items',
        count: overview.itemCount,
        detail:
          'Dublin Core plus crr.* metadata; manifests without bitstreams.',
      },
    ];
  }

  protected solrFlowSteps(overview: SolrOverview): readonly FlowStep[] {
    return [
      {
        label: 'DSpace items',
        count:
          overview.projectionBreakdown?.repositoryItemCount ??
          overview.projectionObjectCount,
        detail: 'System of record queried during reindex.',
      },
      {
        label: 'Projection service',
        count: overview.projectionObjectCount,
        detail:
          'DiscoveryProjectionService maps repository objects to SearchResult.',
      },
      {
        label: 'Discovery core',
        count: overview.indexedDocumentCount,
        detail: `${overview.core ?? 'discovery'} on port 8983 for public search.`,
      },
    ];
  }

  protected solrDonutSegments(overview: SolrOverview): readonly DonutSegment[] {
    const breakdown = overview.projectionBreakdown;
    const indexed =
      breakdown?.indexedCount ?? overview.indexedDocumentCount ?? 0;
    const projected =
      breakdown?.projectedCount ?? overview.projectionObjectCount ?? 0;
    const repositoryItems = breakdown?.repositoryItemCount ?? projected;
    const source = breakdown?.source ?? overview.projectionSource ?? 'FIXTURE';
    const gap = Math.max(0, repositoryItems - indexed);

    if (source === 'FIXTURE') {
      return [
        {
          label: 'Fixture catalog',
          value: Math.max(indexed, projected, 1),
          color: 'var(--mat-sys-tertiary)',
        },
      ];
    }

    return [
      {
        label: 'Indexed in Solr',
        value: indexed,
        color: 'var(--mat-sys-primary)',
      },
      {
        label: 'Not yet indexed',
        value: gap,
        color: 'var(--civics-border-strong)',
      },
    ].filter((segment) => segment.value > 0);
  }

  protected liveDspaceSummary(overview: DspaceOverview): string {
    return [
      overview.reachable ? 'DSpace reachable' : 'DSpace unreachable',
      `${overview.itemCount ?? 0} items`,
      `${overview.communityCount ?? 0} communities`,
      `${overview.collectionCount ?? 0} collections`,
    ].join(', ');
  }

  protected liveSolrSummary(overview: SolrOverview): string {
    return [
      overview.reachable ? 'Solr reachable' : 'Solr unreachable',
      `${overview.indexedDocumentCount ?? 0} indexed documents`,
      `projection source ${overview.projectionSource ?? 'unknown'}`,
    ].join(', ');
  }
}
