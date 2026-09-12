import {
  AfterViewChecked,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  OnInit,
  ViewChild,
} from '@angular/core';
import { Location } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { Store } from '@ngrx/store';
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
    const researchId = this.route.snapshot.paramMap.get('researchId')?.trim();
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

  private safeReturnUrl(value: string | null): string {
    if (!value || !value.startsWith('/') || value.startsWith('//')) {
      return '/';
    }
    return value;
  }
}
