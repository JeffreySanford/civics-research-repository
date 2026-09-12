import { Location } from '@angular/common';
import {
  AfterViewChecked,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  OnInit,
  ViewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { Store } from '@ngrx/store';
import type {
  ResearchObjectType,
  ResearchRelation,
} from 'repository-api-client';
import { encodeResearchId } from 'repository-models';
import { MobileResearchDetailActions } from '../../state/research-detail/research-detail.actions';
import {
  selectMobileResearchDetail,
  selectMobileResearchDetailError,
  selectMobileResearchDetailLoading,
} from '../../state/research-detail/research-detail.selectors';

@Component({
  selector: 'app-mobile-research-detail',
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './mobile-research-detail.component.html',
  styleUrl: './mobile-research-detail.component.scss',
})
export class MobileResearchDetailComponent implements OnInit, AfterViewChecked {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  private readonly store = inject(Store);
  private readonly destroyRef = inject(DestroyRef);
  private readonly openedFromSearch =
    this.router.getCurrentNavigation()?.extras.state?.['fromSearch'] === true;
  private focusPending = true;

  protected readonly detail$ = this.store.select(selectMobileResearchDetail);
  protected readonly loading$ = this.store.select(
    selectMobileResearchDetailLoading,
  );
  protected readonly error$ = this.store.select(
    selectMobileResearchDetailError,
  );
  protected readonly returnUrl = this.safeReturnUrl(
    this.route.snapshot.queryParamMap.get('returnUrl'),
  );

  @ViewChild('detailHeading')
  private readonly detailHeading?: ElementRef<HTMLElement>;

  ngOnInit(): void {
    this.route.paramMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((params) => {
        const researchId = params.get('researchId')?.trim();
        this.focusPending = true;

        if (!researchId) {
          this.store.dispatch(
            MobileResearchDetailActions.detailFailed({
              message: 'The research object identifier is missing.',
            }),
          );
          return;
        }

        this.store.dispatch(
          MobileResearchDetailActions.detailOpened({ researchId }),
        );
      });
  }

  ngAfterViewChecked(): void {
    if (!this.focusPending || !this.detailHeading) {
      return;
    }
    this.focusPending = false;
    queueMicrotask(() => this.detailHeading?.nativeElement.focus());
  }

  protected backToResults(): void {
    if (this.openedFromSearch) {
      this.location.back();
      return;
    }
    void this.router.navigateByUrl(this.returnUrl);
  }

  protected researchRouteId(canonicalId: string): string {
    return encodeResearchId(canonicalId);
  }

  protected relationLabel(verb: ResearchRelation['verb']): string {
    const labels: Record<ResearchRelation['verb'], string> = {
      hasPart: 'Includes',
      uses: 'Uses',
      documents: 'Documents',
      isDerivedFrom: 'Public product derived from',
    };
    return labels[verb];
  }

  protected contentTypeLabel(
    contentType: ResearchObjectType | undefined,
  ): string {
    const labels: Record<ResearchObjectType, string> = {
      DATASET: 'Dataset',
      PUBLICATION: 'Publication',
      CODE: 'Code',
      METHODOLOGY: 'Methodology',
      SUPPORTING_MATERIAL: 'Supporting material',
      PROJECT: 'Research project',
    };
    return contentType ? labels[contentType] : 'Research object';
  }

  private safeReturnUrl(value: string | null): string {
    if (!value || !value.startsWith('/') || value.startsWith('//')) {
      return '/';
    }
    return value;
  }
}
