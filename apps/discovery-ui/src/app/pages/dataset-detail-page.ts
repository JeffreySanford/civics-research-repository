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
import { Store } from '@ngrx/store';
import { filter, map } from 'rxjs';
import { DatasetsActions } from '../state/datasets/datasets.actions';
import {
  selectDatasetDetail,
  selectDatasetError,
  selectDatasetLoading,
  selectDatasetMapLayers,
  selectDatasetVersions,
} from '../state/datasets/datasets.selectors';

@Component({
  selector: 'app-dataset-detail-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AsyncPipe, DatePipe, RouterLink],
  templateUrl: './dataset-detail-page.html',
  styleUrl: './dataset-detail-page.scss',
})
export class DatasetDetailPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly store = inject(Store);

  protected readonly detail$ = this.store.select(selectDatasetDetail);
  protected readonly versions$ = this.store.select(selectDatasetVersions);
  protected readonly mapLayers$ = this.store.select(selectDatasetMapLayers);
  protected readonly loading$ = this.store.select(selectDatasetLoading);
  protected readonly error$ = this.store.select(selectDatasetError);

  ngOnInit(): void {
    this.route.paramMap
      .pipe(
        map((params) => params.get('datasetId')),
        filter((datasetId): datasetId is string => Boolean(datasetId)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((datasetId) => {
        this.store.dispatch(DatasetsActions.datasetOpened({ datasetId }));
      });
  }
}
