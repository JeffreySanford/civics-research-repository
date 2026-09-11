from pathlib import Path


def replace(path: str, old: str, new: str) -> None:
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f"anchor not found in {path}: {old[:100]!r}")
    p.write_text(text.replace(old, new, 1))

# Shared canonical research-id route encoding: second frontend now justifies extraction.
Path('libs/repository/models/src/lib/research-id.ts').write_text(r'''/** Encode a canonical research-object identity as one URL-safe route segment. */
export function encodeResearchId(canonicalId: string): string {
  if (!canonicalId.trim()) {
    throw new Error('Research identity must not be blank.');
  }

  const bytes = new TextEncoder().encode(canonicalId);
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary)
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/u, '');
}
''')
replace(
    'libs/repository/models/src/index.ts',
    "export * from './lib/repository-models';\n",
    "export * from './lib/repository-models';\nexport * from './lib/research-id';\n",
)
Path('apps/discovery-ui/src/app/research-id.ts').write_text(
    "export { encodeResearchId } from 'repository-models';\n"
)

# Mobile detail state.
base = Path('apps/census-mobile-frontend/src/app/state/research-detail')
base.mkdir(parents=True, exist_ok=True)
(base / 'research-detail.actions.ts').write_text(r'''import { createActionGroup, props } from '@ngrx/store';
import type { ResearchObjectDetail } from 'repository-api-client';

export const MobileResearchDetailActions = createActionGroup({
  source: 'Mobile Research Detail',
  events: {
    'Detail Opened': props<{ researchId: string }>(),
    'Detail Loaded': props<{ detail: ResearchObjectDetail }>(),
    'Detail Failed': props<{ message: string }>(),
  },
});
''')
(base / 'research-detail.reducer.ts').write_text(r'''import { createReducer, on } from '@ngrx/store';
import type { ResearchObjectDetail } from 'repository-api-client';
import { MobileResearchDetailActions } from './research-detail.actions';

export interface MobileResearchDetailState {
  readonly researchId: string | null;
  readonly detail: ResearchObjectDetail | null;
  readonly loading: boolean;
  readonly error: string | null;
}

export const initialMobileResearchDetailState: MobileResearchDetailState = {
  researchId: null,
  detail: null,
  loading: false,
  error: null,
};

export const mobileResearchDetailReducer = createReducer(
  initialMobileResearchDetailState,
  on(MobileResearchDetailActions.detailOpened, (state, { researchId }) => ({
    ...state,
    researchId,
    detail: null,
    loading: true,
    error: null,
  })),
  on(MobileResearchDetailActions.detailLoaded, (state, { detail }) => ({
    ...state,
    detail,
    loading: false,
    error: null,
  })),
  on(MobileResearchDetailActions.detailFailed, (state, { message }) => ({
    ...state,
    detail: null,
    loading: false,
    error: message,
  })),
);
''')
(base / 'research-detail.selectors.ts').write_text(r'''import { createFeatureSelector, createSelector } from '@ngrx/store';
import type { MobileResearchDetailState } from './research-detail.reducer';

export const mobileResearchDetailFeatureKey = 'researchDetail';

export const selectMobileResearchDetailState =
  createFeatureSelector<MobileResearchDetailState>(mobileResearchDetailFeatureKey);

export const selectMobileResearchDetail = createSelector(
  selectMobileResearchDetailState,
  (state) => state.detail,
);

export const selectMobileResearchDetailLoading = createSelector(
  selectMobileResearchDetailState,
  (state) => state.loading,
);

export const selectMobileResearchDetailError = createSelector(
  selectMobileResearchDetailState,
  (state) => state.error,
);
''')
(base / 'research-detail.effects.ts').write_text(r'''import { inject, Injectable } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { catchError, map, of, switchMap } from 'rxjs';
import {
  parseRepositoryError,
  RepositoryDatasetsApi,
} from 'repository-api-client';
import { MobileResearchDetailActions } from './research-detail.actions';

@Injectable()
export class MobileResearchDetailEffects {
  private readonly actions$ = inject(Actions);
  private readonly datasetsApi = inject(RepositoryDatasetsApi);

  readonly loadDetail$ = createEffect(() =>
    this.actions$.pipe(
      ofType(MobileResearchDetailActions.detailOpened),
      switchMap(({ researchId }) =>
        this.datasetsApi.getResearchObject(researchId).pipe(
          map((detail) => MobileResearchDetailActions.detailLoaded({ detail })),
          catchError((error: unknown) =>
            of(
              MobileResearchDetailActions.detailFailed({
                message: parseRepositoryError(
                  error,
                  'Research object detail failed to load.',
                ).message,
              }),
            ),
          ),
        ),
      ),
    ),
  );
}
''')
(base / 'research-detail.reducer.spec.ts').write_text(r'''import { MobileResearchDetailActions } from './research-detail.actions';
import {
  initialMobileResearchDetailState,
  mobileResearchDetailReducer,
} from './research-detail.reducer';

describe('mobileResearchDetailReducer', () => {
  it('starts a detail request without retaining a previous object', () => {
    const state = mobileResearchDetailReducer(
      { ...initialMobileResearchDetailState, detail: {} as never },
      MobileResearchDetailActions.detailOpened({ researchId: 'token' }),
    );

    expect(state.researchId).toBe('token');
    expect(state.loading).toBe(true);
    expect(state.detail).toBeNull();
    expect(state.error).toBeNull();
  });

  it('surfaces a failed detail request', () => {
    const state = mobileResearchDetailReducer(
      initialMobileResearchDetailState,
      MobileResearchDetailActions.detailFailed({ message: 'Not found' }),
    );

    expect(state.loading).toBe(false);
    expect(state.error).toBe('Not found');
  });
});
''')

# Mobile detail component.
component = Path('apps/census-mobile-frontend/src/app/components/mobile-research-detail')
component.mkdir(parents=True, exist_ok=True)
(component / 'mobile-research-detail.component.ts').write_text(r'''import {
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
  protected readonly error$ = this.store.select(selectMobileResearchDetailError);
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

    this.store.dispatch(MobileResearchDetailActions.detailOpened({ researchId }));
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
''')
(component / 'mobile-research-detail.component.html').write_text(r'''<section class="detail-page" aria-labelledby="mobile-detail-title">
  <button class="detail-back" type="button" (click)="backToResults()">
    ← Back to results
  </button>

  @if (loading$ | async) {
    <div class="detail-status" role="status">
      <strong>Loading research object…</strong>
      <span>Retrieving repository metadata and provenance.</span>
    </div>
  }

  @if (error$ | async; as error) {
    <div class="detail-status detail-status--error" role="alert">
      <strong>Research object could not be loaded.</strong>
      <span>{{ error }}</span>
    </div>
  }

  @if (detail$ | async; as detail) {
    @if (detail.source === 'FEDERATED') {
      <aside class="provenance-note" role="note">
        <strong>Federated metadata.</strong>
        The publisher remains authoritative for this research object and its
        downloadable files.
      </aside>
    }

    <div class="detail-heading">
      <p class="detail-eyebrow">{{ detail.contentType ?? 'Research object' }}</p>
      <h1 #detailHeading id="mobile-detail-title" tabindex="-1">
        {{ detail.title }}
      </h1>
      @if (detail.authors?.length) {
        <p class="detail-authors">
          @for (author of detail.authors; track author.name; let last = $last) {
            <span>{{ author.name }}</span>{{ last ? '' : ', ' }}
          }
        </p>
      }
      <p class="detail-summary">{{ detail.abstractText }}</p>
    </div>

    @if (detail.accessLevel && detail.accessLevel !== 'PUBLIC') {
      <aside class="access-note" role="note">
        <strong>{{ detail.accessLevel }}</strong>
        @if (detail.accessNote) { <span>{{ detail.accessNote }}</span> }
      </aside>
    }

    <dl class="detail-list">
      <div><dt>Program</dt><dd>{{ detail.programName ?? detail.program }}</dd></div>
      <div><dt>Publisher</dt><dd>{{ detail.publisher }}</dd></div>
      <div><dt>Source system</dt><dd>{{ detail.sourceSystem }}</dd></div>
      <div><dt>Geography</dt><dd>{{ detail.geography ?? 'Not specified' }}</dd></div>
      <div><dt>Vintage</dt><dd>{{ detail.vintageYear ?? 'Not specified' }}</dd></div>
      <div><dt>Access</dt><dd>{{ detail.accessLevel ?? 'Not stated' }}</dd></div>
      <div><dt>Reuse</dt><dd>{{ detail.license ?? 'Not stated' }}</dd></div>
      @if (detail.doi) { <div><dt>DOI</dt><dd>{{ detail.doi }}</dd></div> }
    </dl>

    <section class="detail-section" aria-labelledby="citation-heading">
      <h2 id="citation-heading">Citation</h2>
      <p>{{ detail.citation }}</p>
    </section>

    <section class="detail-section" aria-labelledby="files-heading">
      <h2 id="files-heading">Files and source</h2>
      @if (detail.files.length) {
        <ul class="detail-files">
          @for (file of detail.files; track file.id) {
            <li>
              <strong>{{ file.label }}</strong>
              <span>{{ file.format }}</span>
              <a [href]="file.url" target="_blank" rel="noreferrer">Open file</a>
            </li>
          }
        </ul>
      } @else if (detail.source === 'FEDERATED') {
        <p>No publisher files are preserved locally for this federated record.</p>
      } @else {
        <p>No files are listed for this research object.</p>
      }
      <a
        class="authoritative-link"
        [href]="detail.sourceUrl"
        target="_blank"
        rel="noreferrer"
      >View authoritative source</a>
    </section>
  }
</section>
''')
(component / 'mobile-research-detail.component.scss').write_text(r''':host {
  display: block;
}

.detail-page {
  display: grid;
  gap: 1rem;
}

.detail-back {
  justify-self: start;
  min-height: 2.75rem;
  padding: 0.65rem 0.9rem;
  border: 1px solid var(--civics-border-strong);
  border-radius: var(--civics-radius-sm);
  background: var(--civics-surface-panel);
  color: var(--civics-text-primary);
  font: inherit;
  font-weight: 750;
  cursor: pointer;
}

.detail-status,
.provenance-note,
.access-note,
.detail-heading,
.detail-list,
.detail-section {
  padding: 1rem;
  border: 1px solid var(--civics-border);
  border-radius: var(--civics-radius-md);
  background: var(--civics-surface-panel);
}

.detail-status,
.provenance-note,
.access-note {
  display: grid;
  gap: 0.3rem;
}

.detail-status--error,
.access-note {
  border-width: 2px;
}

.detail-eyebrow {
  margin: 0 0 0.4rem;
  font-size: 0.78rem;
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--civics-text-secondary);
}

.detail-heading h1,
.detail-section h2,
.detail-summary,
.detail-authors,
.detail-section p {
  margin-top: 0;
}

.detail-heading h1 {
  font-size: clamp(1.5rem, 7vw, 2.25rem);
  line-height: 1.15;
}

.detail-list {
  display: grid;
  gap: 0.9rem;
  margin: 0;
}

.detail-list div {
  display: grid;
  gap: 0.2rem;
  min-width: 0;
}

.detail-list dt {
  font-weight: 800;
}

.detail-list dd {
  margin: 0;
  overflow-wrap: anywhere;
}

.detail-files {
  display: grid;
  gap: 0.75rem;
  padding-left: 1.25rem;
}

.detail-files li {
  display: grid;
  gap: 0.2rem;
}

.authoritative-link,
.detail-files a {
  overflow-wrap: anywhere;
}

@media (min-width: 42rem) {
  .detail-list {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (forced-colors: active) {
  .detail-back,
  .detail-status,
  .provenance-note,
  .access-note,
  .detail-heading,
  .detail-list,
  .detail-section {
    border-color: CanvasText;
  }
}
''')

# Route.
Path('apps/census-mobile-frontend/src/app/app.routes.ts').write_text(r'''import type { Routes } from '@angular/router';
import { MobileResearchDetailComponent } from './components/mobile-research-detail/mobile-research-detail.component';

export const appRoutes: Routes = [
  { path: 'research/:researchId', component: MobileResearchDetailComponent },
];
''')

# AppModule detail state + component.
path = 'apps/census-mobile-frontend/src/app/app-module.ts'
replace(path,
    "import { MobileSearchFiltersComponent } from './components/mobile-search-filters/mobile-search-filters.component';\n",
    "import { MobileSearchFiltersComponent } from './components/mobile-search-filters/mobile-search-filters.component';\nimport { MobileResearchDetailComponent } from './components/mobile-research-detail/mobile-research-detail.component';\n")
replace(path,
    "import { MobileSearchEffects } from './state/search/search.effects';\n",
    "import { MobileResearchDetailEffects } from './state/research-detail/research-detail.effects';\nimport { mobileResearchDetailReducer } from './state/research-detail/research-detail.reducer';\nimport { MobileSearchEffects } from './state/search/search.effects';\n")
replace(path,
    "    MobileSearchFiltersComponent,\n",
    "    MobileSearchFiltersComponent,\n    MobileResearchDetailComponent,\n")
replace(path,
    "    StoreModule.forRoot({ mobileSearch: mobileSearchReducer }),\n    EffectsModule.forRoot([MobileSearchEffects]),",
    "    StoreModule.forRoot({\n      mobileSearch: mobileSearchReducer,\n      researchDetail: mobileResearchDetailReducer,\n    }),\n    EffectsModule.forRoot([MobileSearchEffects, MobileResearchDetailEffects]),")

# Root app route awareness, search/detail swap, and result focus restoration.
path = 'apps/census-mobile-frontend/src/app/app.ts'
replace(path, "import type { SearchQuery } from 'repository-api-client';\n", "import type { SearchQuery } from 'repository-api-client';\nimport { encodeResearchId } from 'repository-models';\n")
replace(path, "import { filter, take } from 'rxjs';\n", "import { filter } from 'rxjs';\n")
replace(path,
    "  readonly queryText = signal('');\n  readonly filtersOpen = signal(false);\n",
    "  readonly queryText = signal('');\n  readonly filtersOpen = signal(false);\n  readonly detailRoute = signal(false);\n  private lastOpenedResultIndex: number | null = null;\n")
replace(path,
    "  ngOnInit(): void {\n    if (this.hydrateFromRouterUrl(this.router.url)) {\n      return;\n    }\n\n    this.router.events\n      .pipe(\n        filter(\n          (event): event is NavigationEnd => event instanceof NavigationEnd,\n        ),\n        take(1),\n      )\n      .subscribe((event) => {\n        this.hydrateFromRouterUrl(event.urlAfterRedirects);\n      });\n  }",
    """  ngOnInit(): void {
    this.syncRoute(this.router.url);
    this.router.events
      .pipe(
        filter(
          (event): event is NavigationEnd => event instanceof NavigationEnd,
        ),
      )
      .subscribe((event) => this.syncRoute(event.urlAfterRedirects));
  }""")
replace(path,
    "  isTopRanked(index: number): boolean {\n    return this.globalRank(index) <= 3;\n  }\n\n  private hydrateFromRouterUrl(url: string): boolean {",
    """  isTopRanked(index: number): boolean {
    return this.globalRank(index) <= 3;
  }

  researchRouteId(canonicalId: string): string {
    return encodeResearchId(canonicalId);
  }

  searchReturnUrl(): string {
    return this.router.url.startsWith('/research/') ? '/' : this.router.url;
  }

  rememberResultFocus(index: number): void {
    this.lastOpenedResultIndex = index;
  }

  private syncRoute(url: string): void {
    const wasDetail = this.detailRoute();
    const isDetail = this.router.parseUrl(url).root.children['primary']?.segments[0]?.path === 'research';
    this.detailRoute.set(isDetail);
    if (isDetail) {
      return;
    }

    this.hydrateFromRouterUrl(url);
    if (wasDetail) {
      this.restoreResultFocus();
    }
  }

  private restoreResultFocus(): void {
    const index = this.lastOpenedResultIndex;
    if (index === null) {
      return;
    }
    requestAnimationFrame(() => {
      const link = document.querySelector<HTMLAnchorElement>(
        `[data-result-index=\"${index}\"] .result-card__detail-link`,
      );
      link?.focus();
    });
  }

  private hydrateFromRouterUrl(url: string): boolean {""")
# Avoid duplicate search request when returning from a detail route and store already represents URL.
replace(path,
    "    const query = this.routeQueryAdapter.fromParamMap(params);\n    this.queryText.set(query.q ?? '');\n    this.store.dispatch(MobileSearchActions.searchSubmitted({ query }));\n    return true;",
    """    const query = this.routeQueryAdapter.fromParamMap(params);
    this.queryText.set(query.q ?? '');
    const currentParams = this.routeQueryAdapter.toQueryParams(
      this.searchState().query,
    );
    const nextParams = this.routeQueryAdapter.toQueryParams(query);
    if (
      JSON.stringify(currentParams) !== JSON.stringify(nextParams) ||
      (!this.response() && !this.loading())
    ) {
      this.store.dispatch(MobileSearchActions.searchSubmitted({ query }));
    }
    return true;""")

# Root template: show search journey or routed detail, plus interactive result links.
path = 'apps/census-mobile-frontend/src/app/app.html'
replace(path,
    '<main id="main-content" class="page-shell" tabindex="-1">\n  <section class="hero"',
    '<main id="main-content" class="page-shell" tabindex="-1">\n  @if (!detailRoute()) {\n  <section class="hero"')
replace(path,
    '      <li\n        class="result-card"',
    '      <li\n        class="result-card"\n        [attr.data-result-index]="index"')
replace(path,
    '        <h3>{{ result.title }}</h3>\n',
    '''        <h3>
          <a
            class="result-card__title-link"
            [routerLink]="['/research', researchRouteId(result.id)]"
            [queryParams]="{ returnUrl: searchReturnUrl() }"
            [state]="{ fromSearch: true }"
            (click)="rememberResultFocus(index)"
          >{{ result.title }}</a>
        </h3>
''')
replace(path,
    '        <app-search-match-evidence\n          [evidence]="result.matchEvidence"\n        ></app-search-match-evidence>\n',
    '''        <app-search-match-evidence
          [evidence]="result.matchEvidence"
        ></app-search-match-evidence>
        <a
          class="result-card__detail-link"
          [routerLink]="['/research', researchRouteId(result.id)]"
          [queryParams]="{ returnUrl: searchReturnUrl() }"
          [state]="{ fromSearch: true }"
          (click)="rememberResultFocus(index)"
          [attr.aria-label]="'View research object: ' + result.title"
        >View research object</a>
''')
replace(path,
    '  <router-outlet></router-outlet>\n</main>',
    '''  } @else {
  <router-outlet></router-outlet>
  }
</main>''')

# App styling for real links.
path = 'apps/census-mobile-frontend/src/app/app.scss'
p = Path(path)
text = p.read_text()
text += r'''

.result-card__title-link,
.result-card__detail-link {
  color: var(--mat-sys-primary);
  text-decoration-thickness: 0.08em;
  text-underline-offset: 0.16em;
}

.result-card__detail-link {
  display: inline-flex;
  min-height: 2.75rem;
  align-items: center;
  margin-top: 0.8rem;
  font-weight: 800;
}
'''
p.write_text(text)

# App test harness needs detail declaration/store feature but retains existing search tests.
path = 'apps/census-mobile-frontend/src/app/app.spec.ts'
replace(path,
    "import { MobileSearchFiltersComponent } from './components/mobile-search-filters/mobile-search-filters.component';\n",
    "import { MobileSearchFiltersComponent } from './components/mobile-search-filters/mobile-search-filters.component';\nimport { MobileResearchDetailComponent } from './components/mobile-research-detail/mobile-research-detail.component';\n")
replace(path,
    "import { MobileSearchActions } from './state/search/search.actions';\n",
    "import { mobileResearchDetailReducer } from './state/research-detail/research-detail.reducer';\nimport { MobileSearchActions } from './state/search/search.actions';\n")
replace(path,
    "        StoreModule.forRoot({ mobileSearch: mobileSearchReducer }),",
    "        StoreModule.forRoot({\n          mobileSearch: mobileSearchReducer,\n          researchDetail: mobileResearchDetailReducer,\n        }),")
replace(path,
    "        MobileSearchFiltersComponent,\n",
    "        MobileSearchFiltersComponent,\n        MobileResearchDetailComponent,\n")

# E2E detail journey at the existing 320px project.
Path('apps/census-mobile-frontend-e2e/src/research-detail.spec.ts').write_text(r'''import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const axeTags = [
  'wcag2a',
  'wcag2aa',
  'wcag21a',
  'wcag21aa',
  'wcag22aa',
  'best-practice',
];

async function mockSearch(page: Page): Promise<void> {
  await page.route('**/api/search/cursor*', async (route) => {
    const url = new URL(route.request().url());
    const query = url.searchParams.get('q')?.trim() ?? '';
    const contentType = url.searchParams.get('contentType');
    const result = {
      id: 'north-dakota-migration',
      title: 'Migration Flows for North Dakota',
      contentType: 'DATASET',
      program: 'ACS',
      programName: 'Population Mobility',
      publisher: 'U.S. Census Bureau',
      summary: 'Migration research metadata for North Dakota.',
      sourceUrl: 'https://www.census.gov/',
      origin: 'CURATED',
      sourceSystem: 'DSPACE',
      geography: 'North Dakota',
      vintageYear: 2025,
      relevance: { rawScore: 10, normalizedScore: 1, band: 'STRONG' },
    };
    await route.fulfill({
      contentType: 'application/json',
      json: {
        search: {
          resultSource: 'REPOSITORY',
          query,
          page: 0,
          pageSize: 10,
          totalResults: 1,
          results: contentType && contentType !== 'DATASET' ? [] : [result],
          facets: [
            {
              field: 'type',
              label: 'Type',
              values: [
                {
                  value: 'DATASET',
                  label: 'Dataset',
                  count: 1,
                  selected: contentType === 'DATASET',
                },
              ],
            },
          ],
          relevanceModel: {
            engine: 'SOLR',
            normalization: 'SOLR_MAX_SCORE_RATIO_V1',
            calibrated: false,
          },
        },
        nextCursor: null,
      },
    });
  });
}

async function mockDetail(page: Page): Promise<void> {
  await page.route('**/api/research/*', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      json: {
        source: 'REPOSITORY',
        id: 'north-dakota-migration',
        title: 'Migration Flows for North Dakota',
        contentType: 'DATASET',
        program: 'ACS',
        programName: 'Population Mobility',
        publisher: 'U.S. Census Bureau',
        abstractText: 'Research metadata describing interstate migration flows for North Dakota.',
        sourceSystem: 'DSPACE',
        geography: 'North Dakota',
        vintageYear: 2025,
        accessLevel: 'PUBLIC',
        license: 'Public domain',
        citation: 'U.S. Census Bureau. Migration Flows for North Dakota.',
        sourceUrl: 'https://www.census.gov/topics/population/migration.html',
        files: [
          {
            id: 'migration-table',
            label: 'Migration table',
            format: 'CSV',
            url: 'https://example.test/migration.csv',
          },
        ],
        authors: [],
        relatedResearch: [],
      },
    });
  });
}

test.describe('mobile research detail navigation', () => {
  test.beforeEach(async ({ page }) => {
    await mockSearch(page);
    await mockDetail(page);
  });

  test('opens a result and returns to the exact filtered search at 320px @wcag', async ({
    page,
  }) => {
    await page.goto('/?q=North%20Dakota%20migration&type=DATASET');
    const viewLink = page.getByRole('link', {
      name: 'View research object: Migration Flows for North Dakota',
    });
    await expect(viewLink).toBeVisible();
    await viewLink.click();

    await expect(page).toHaveURL(/\/research\//);
    const heading = page.getByRole('heading', {
      level: 1,
      name: 'Migration Flows for North Dakota',
    });
    await expect(heading).toBeVisible();
    await expect(heading).toBeFocused();
    await expect(page.getByText('Population Mobility')).toBeVisible();
    await expect(page.getByText('Public domain')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Open file' })).toBeVisible();
    await expect(
      page.getByRole('link', { name: 'View authoritative source' }),
    ).toBeVisible();

    const accessibility = await new AxeBuilder({ page })
      .withTags(axeTags)
      .analyze();
    expect(accessibility.violations).toEqual([]);

    await page.getByRole('button', { name: 'Back to results' }).click();
    await expect
      .poll(() => new URL(page.url()).searchParams.get('q'))
      .toBe('North Dakota migration');
    expect(new URL(page.url()).searchParams.get('type')).toBe('DATASET');
    await expect(page.locator('#research-query')).toHaveValue(
      'North Dakota migration',
    );
    await expect(page.locator('.active-filters')).toContainText('Dataset');
    await expect(viewLink).toBeFocused();
  });

  test('deep-links to federated provenance and uses the return URL fallback @wcag', async ({
    page,
  }) => {
    await page.route('**/api/research/*', async (route) => {
      await route.fulfill({
        contentType: 'application/json',
        json: {
          source: 'FEDERATED',
          id: 'DATA_GOV:https://example.test/federated',
          title: 'Federated Migration Metadata',
          contentType: 'PUBLICATION',
          program: 'OTHER',
          programName: 'Population Research',
          publisher: 'Example Federal Publisher',
          abstractText: 'Federated metadata retained for discovery.',
          sourceSystem: 'DATA_GOV',
          accessLevel: 'PUBLIC',
          citation: 'Federated Migration Metadata',
          sourceUrl: 'https://example.test/federated',
          files: [],
          authors: [],
          relatedResearch: [],
        },
      });
    });

    await page.goto(
      '/research/REFUQV9HT1Y6aHR0cHM6Ly9leGFtcGxlLnRlc3QvZmVkZXJhdGVk?returnUrl=%2F%3Fq%3Dmigration',
    );
    await expect(page.getByText('Federated metadata.')).toBeVisible();
    await expect(
      page.getByText('No publisher files are preserved locally'),
    ).toBeVisible();

    const accessibility = await new AxeBuilder({ page })
      .withTags(axeTags)
      .analyze();
    expect(accessibility.violations).toEqual([]);

    await page.getByRole('button', { name: 'Back to results' }).click();
    await expect(page).toHaveURL(/\?q=migration/);
  });

  test('announces a detail failure @wcag', async ({ page }) => {
    await page.route('**/api/research/*', async (route) => {
      await route.fulfill({ status: 404, contentType: 'application/json', json: { message: 'Not found' } });
    });
    await page.goto('/research/dW5rbm93bg');
    await expect(page.getByRole('alert')).toContainText(
      'Research object could not be loaded',
    );
  });
});
''')
