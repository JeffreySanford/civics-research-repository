import { AsyncPipe, DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  inject,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatTabsModule } from '@angular/material/tabs';
import { Store } from '@ngrx/store';
import type {
  ResearchObjectType,
  ResearchRelation,
} from 'repository-api-client';
import { encodeResearchId } from '../research-id';
import { DatasetsActions } from '../state/datasets/datasets.actions';
import {
  selectResearchObjectDetail,
  selectDatasetSource,
  selectDatasetError,
  selectDatasetLoading,
  selectDatasetMapLayers,
  selectDatasetVersions,
} from '../state/datasets/datasets.selectors';

@Component({
  selector: 'app-dataset-detail-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AsyncPipe, DatePipe, MatTabsModule, RouterLink],
  templateUrl: './dataset-detail-page.html',
  styleUrl: './dataset-detail-page.scss',
})
export class ResearchObjectDetailPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly store = inject(Store);

  protected readonly detail$ = this.store.select(selectResearchObjectDetail);
  protected readonly datasetSource$ = this.store.select(selectDatasetSource);
  protected readonly versions$ = this.store.select(selectDatasetVersions);
  protected readonly mapLayers$ = this.store.select(selectDatasetMapLayers);
  protected readonly loading$ = this.store.select(selectDatasetLoading);
  protected readonly error$ = this.store.select(selectDatasetError);

  ngOnInit(): void {
    this.route.paramMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((params) => {
        const researchId = params.get('researchId');
        if (researchId) {
          this.store.dispatch(DatasetsActions.researchOpened({ researchId }));
          return;
        }

        const datasetId = params.get('datasetId');
        if (datasetId) {
          this.store.dispatch(DatasetsActions.datasetOpened({ datasetId }));
        }
      });
  }

  protected researchRouteId(canonicalId: string): string {
    return encodeResearchId(canonicalId);
  }

  /**
   * Human wording for the contract's SCREAMING_CASE type.
   *
   * The badge on a result card can afford to show the raw value beside four others like it; a
   * page heading cannot, and SUPPORTING_MATERIAL as an eyebrow reads like a database dump.
   */
  protected typeLabel(contentType: ResearchObjectType | undefined): string {
    const labels: Record<ResearchObjectType, string> = {
      DATASET: 'Dataset',
      PUBLICATION: 'Publication',
      CODE: 'Code',
      METHODOLOGY: 'Methodology',
      SUPPORTING_MATERIAL: 'Supporting material',
      PROJECT: 'Research project',
    };
    return contentType ? labels[contentType] : 'Dataset';
  }

  /** Verbs read as sentences about this object, so the relation list needs no legend. */
  protected relationLabel(verb: ResearchRelation['verb']): string {
    const labels: Record<ResearchRelation['verb'], string> = {
      hasPart: 'Includes',
      uses: 'Uses',
      documents: 'Documents',
      isDerivedFrom: 'Public product derived from',
    };
    return labels[verb];
  }
}
