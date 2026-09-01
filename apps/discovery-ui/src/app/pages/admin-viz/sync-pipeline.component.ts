import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { AdminCompositeCorpusEvidenceComponent } from '../admin-composite-corpus-evidence.component';
import { AdminCorpusArchivesComponent } from '../admin-corpus-archives.component';
import { AdminCorpusStorageComponent } from '../admin-corpus-storage.component';
import { adminFlowStepEnter } from './admin-viz.animations';

export type PipelineStage =
  | 'idle'
  | 'ui'
  | 'api'
  | 'dspace'
  | 'solr'
  | 'postgres';

@Component({
  selector: 'app-admin-sync-pipeline',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AdminCorpusStorageComponent,
    AdminCompositeCorpusEvidenceComponent,
    AdminCorpusArchivesComponent,
  ],
  animations: [adminFlowStepEnter],
  template: `
    <figure class="admin-viz-pipeline">
      <ol class="admin-viz-pipeline__steps" aria-hidden="true">
        @for (node of nodes; track node.id; let last = $last) {
          <li
            class="admin-viz-pipeline__step"
            [class.admin-viz-pipeline__step--active]="activeStage() === node.id"
            [class.admin-viz-pipeline__step--complete]="isComplete(node.id)"
            @adminFlowStepEnter
          >
            <div class="admin-viz-pipeline__node admin-viz-card">
              <span class="admin-viz-flow__label">{{ node.label }}</span>
              <p>{{ node.detail }}</p>
            </div>
            @if (!last) {
              <span
                class="admin-viz-pipeline__connector"
                [class.admin-viz-pipeline__connector--active]="
                  isConnectorActive(node.id)
                "
              ></span>
            }
          </li>
        }
      </ol>
      <figcaption class="visually-hidden">
        Request path from Discovery UI through repository-api to DSpace, the
        configured search projections, and Postgres civics_ops. Active stage:
        {{ activeStageLabel() }}.
      </figcaption>
    </figure>
    <app-admin-corpus-storage />
    <app-admin-composite-corpus-evidence />
    <app-admin-corpus-archives />
  `,
  styleUrl: './admin-viz.scss',
})
export class AdminSyncPipelineComponent {
  readonly activeStage = input<PipelineStage>('idle');

  protected readonly nodes = [
    {
      id: 'ui' as const,
      label: 'Discovery UI',
      detail: 'Operator triggers dry run, diff, apply, or reindex.',
    },
    {
      id: 'api' as const,
      label: 'repository-api',
      detail: 'Plans sync actions and persists job history.',
    },
    {
      id: 'dspace' as const,
      label: 'DSpace REST',
      detail: 'Communities, collections, items, and crr metadata.',
    },
    {
      id: 'solr' as const,
      label: 'Search projections',
      detail:
        'One normalized document set is projected to Solr and OpenSearch.',
    },
    {
      id: 'postgres' as const,
      label: 'Postgres civics_ops',
      detail: 'Sync job history and operational state.',
    },
  ] as const;

  protected isComplete(stage: PipelineStage): boolean {
    const order: PipelineStage[] = ['ui', 'api', 'dspace', 'solr', 'postgres'];
    const active = this.activeStage();
    if (active === 'idle') {
      return false;
    }
    return order.indexOf(stage) < order.indexOf(active);
  }

  protected isConnectorActive(stage: PipelineStage): boolean {
    const active = this.activeStage();
    if (active === 'idle') {
      return false;
    }
    const order: PipelineStage[] = ['ui', 'api', 'dspace', 'solr', 'postgres'];
    return order.indexOf(stage) < order.indexOf(active);
  }

  protected activeStageLabel(): string {
    const match = this.nodes.find((node) => node.id === this.activeStage());
    return match?.label ?? 'Idle';
  }
}
