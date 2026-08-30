import { AsyncPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  ViewChild,
  OnInit,
  inject,
} from '@angular/core';
import { ReactiveFormsModule, FormControl } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Store } from '@ngrx/store';
import type {
  ResearchObjectType,
  ResearchProgram,
  SearchQuery,
} from 'repository-api-client';
import { SearchActions } from '../state/search/search.actions';
import {
  selectSearchError,
  selectSearchFacets,
  selectMapExploreGeography,
  selectSearchLoading,
  selectSearchPagination,
  selectSearchResultSource,
  selectSearchResults,
  selectSearchTotalResults,
} from '../state/search/search.selectors';

const PAGE_SIZE = 25;

@Component({
  selector: 'app-discovery-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AsyncPipe,
    ReactiveFormsModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    RouterLink,
  ],
  templateUrl: './discovery-page.html',
})
export class DiscoveryPage implements OnInit {
  private readonly store = inject(Store);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly searchControl = new FormControl('', {
    nonNullable: true,
  });
  /**
   * The three programs of the geospatial map story, offered as a shortcut.
   *
   * These used to be the implicit default, applied whenever the URL carried no `program`
   * parameter. That was right when the repository was three Census datasets and a map. It stopped
   * being right when the repository gained publications, methodology and a research project, all
   * under LEHD: the first thing a visitor saw silently excluded the newest and most interesting
   * objects in the catalog, and nothing on the page said so.
   *
   * They remain a labelled convenience button, which is honest — a filter the reader chooses is
   * not the same as a filter applied on their behalf.
   */
  protected readonly featuredPrograms: readonly ResearchProgram[] = [
    'TIGER_LINE',
    'LODES',
    'ACS',
  ];

  /**
   * Empty means every program. Values are deliberately strings rather than ResearchProgram:
   * federated publishers own their program taxonomy and values such as "Office of Science" must
   * survive URL/deep-link round trips without being collapsed into the curated compatibility enum.
   */
  protected selectedPrograms: string[] = [];

  protected readonly programControl = new FormControl('', { nonNullable: true });
  /** Empty means every type. One value at a time: the contract takes a single content type. */
  protected selectedContentType: ResearchObjectType | '' = '';

  /** Empty means every vintage. One at a time: the contract takes a single year. */
  protected selectedVintageYear: number | null = null;

  /** Zero-based, matching the contract. Rendered one-based, matching how people count. */
  protected page = 0;

  @ViewChild('resultsHeading')
  private readonly resultsHeading?: ElementRef<HTMLElement>;

  protected readonly geographyControl = new FormControl('', {
    nonNullable: true,
  });

  protected readonly results$ = this.store.select(selectSearchResults);
  protected readonly resultSource$ = this.store.select(
    selectSearchResultSource,
  );
  protected readonly facets$ = this.store.select(selectSearchFacets);
  protected readonly totalResults$ = this.store.select(
    selectSearchTotalResults,
  );
  protected readonly pagination$ = this.store.select(selectSearchPagination);
  protected readonly exploreGeography$ = this.store.select(
    selectMapExploreGeography,
  );
  protected readonly loading$ = this.store.select(selectSearchLoading);
  protected readonly error$ = this.store.select(selectSearchError);

  ngOnInit(): void {
    const params = this.route.snapshot.queryParamMap;
    this.searchControl.setValue(params.get('q') ?? '');
    this.selectedPrograms = this.toProgramNames(params.getAll('program'));
    this.programControl.setValue(this.selectedPrograms[0] ?? '');
    this.geographyControl.setValue(params.get('geography') ?? '');
    this.selectedContentType = (params.get('type') ?? '') as
      | ResearchObjectType
      | '';
    this.selectedVintageYear = this.toVintageYear(params.get('vintageYear'));
    this.page = this.toPage(params.get('page'));

    // Not submitSearch(): that resets to the first page, which is right when a filter changes and
    // wrong on load. A deep link to ?page=1 must open on page 2, not silently on page 1.
    this.updateSearchUrl();
    this.dispatchSearch();
  }

  /**
   * Submits a search, returning to the first page.
   *
   * Every filter change resets the page. Staying on page 4 after narrowing 181 results to 12 shows
   * an empty list, which reads as "no results" rather than "you are past the end".
   */
  protected submitSearch(): void {
    this.page = 0;
    this.updateSearchUrl();
    this.dispatchSearch();
  }

  /** Moves to another page, keeping every filter as it is. */
  protected goToPage(page: number): void {
    this.page = Math.max(0, page);
    this.updateSearchUrl();
    this.dispatchSearch();

    // Paging replaces the whole list. Without moving focus, a keyboard or screen-reader user is
    // left on a button whose surrounding content silently changed underneath them.
    this.resultsHeading?.nativeElement.focus();
  }

  private dispatchSearch(): void {
    const baseQuery: SearchQuery = {
      q: this.searchControl.value,
      page: this.page,
      pageSize: PAGE_SIZE,
    };
    const query = {
      ...baseQuery,
      ...(this.selectedPrograms.length
        ? { programs: this.selectedPrograms }
        : {}),
      ...(this.geographyControl.value
        ? { geography: this.geographyControl.value }
        : {}),
      ...(this.selectedContentType
        ? { contentType: this.selectedContentType }
        : {}),
      ...(this.selectedVintageYear !== null
        ? { vintageYear: this.selectedVintageYear }
        : {}),
    };

    this.store.dispatch(SearchActions.searchSubmitted({ query }));
  }

  /** Toggles one data-driven program name in or out of the selection. */
  protected toggleProgram(program: string): void {
    this.selectedPrograms = this.selectedPrograms.includes(program)
      ? this.selectedPrograms.filter((selected) => selected !== program)
      : [...this.selectedPrograms, program];
    this.programControl.setValue(this.selectedPrograms[0] ?? '');
    this.submitSearch();
  }

  protected selectGeography(geography: string): void {
    this.geographyControl.setValue(geography);
    this.submitSearch();
  }

  protected selectFacet(field: string, value: string): void {
    if (field === 'program') {
      this.toggleProgram(value);
      return;
    }

    if (field === 'geography') {
      this.selectGeography(value);
      return;
    }

    if (field === 'type') {
      this.toggleContentType(value);
      return;
    }

    if (field === 'vintageYear') {
      this.toggleVintageYear(value);
    }
  }

  /** Reselecting the chosen year clears it, the same way the type facet behaves. */
  protected toggleVintageYear(vintageYear: string): void {
    const parsed = Number(vintageYear);
    this.selectedVintageYear =
      this.selectedVintageYear === parsed || !Number.isInteger(parsed)
        ? null
        : parsed;
    this.submitSearch();
  }

  /**
   * Selecting the type already selected clears it, rather than being a no-op.
   *
   * The type facet holds one value at a time, so without this a reader who filters to
   * Publication has no way back to everything except Clear filters, which would also throw away
   * their query and geography.
   */
  protected toggleContentType(contentType: string): void {
    this.selectedContentType =
      this.selectedContentType === contentType
        ? ''
        : (contentType as ResearchObjectType);
    this.submitSearch();
  }

  /** Selects the three geospatial programs, or clears them if they are already the selection. */
  protected selectFeaturedPrograms(): void {
    const featured = [...this.featuredPrograms];
    const alreadyFeatured =
      this.selectedPrograms.length === featured.length &&
      featured.every((program) => this.selectedPrograms.includes(program));

    this.selectedPrograms = alreadyFeatured ? [] : featured;
    this.programControl.setValue(this.selectedPrograms[0] ?? '');
    this.submitSearch();
  }

  protected get featuredProgramsSelected(): boolean {
    return (
      this.selectedPrograms.length === this.featuredPrograms.length &&
      this.featuredPrograms.every((program) =>
        this.selectedPrograms.includes(program),
      )
    );
  }

  protected isProgramSelected(program: string): boolean {
    return this.selectedPrograms.includes(program);
  }

  protected clearFilters(): void {
    this.selectedContentType = '';
    this.selectedVintageYear = null;
    this.selectedPrograms = [];
    this.programControl.setValue('');
    this.geographyControl.setValue('');
    this.submitSearch();
  }

  private updateSearchUrl(): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        q: this.searchControl.value || null,
        program: this.selectedPrograms.length
          ? [...this.selectedPrograms]
          : null,
        geography: this.geographyControl.value || null,
        type: this.selectedContentType || null,
        vintageYear: this.selectedVintageYear ?? null,
        // Page 1 is the default, so it stays out of the URL: a shared link to the first page of
        // results should look like a link to the results.
        page: this.page > 0 ? this.page : null,
      },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  /**
   * Query parameters for the workforce map, built here so the link is a real href.
   *
   * The layers are chosen for the research question rather than turned on wholesale: TIGER gives
   * the geography, LODES the workers, SAIPE the socioeconomic context. Hydrography and earthquakes
   * are explicitly off — they are reference layers with nothing to say about workforce, and
   * carrying them in would make the workspace a GIS sampler again.
   *
   * The query is passed along so the map can say what search the reader arrived from and offer a
   * way back, not so the map can re-run it.
   */
  protected exploreMapParams(geography: string): Record<string, string> {
    return {
      area: geography,
      view: 'workforce',
      tiger: 'on',
      lodes: 'on',
      workplace: 'on',
      saipe: 'on',
      hydrography: 'off',
      earthquakes: 'off',
      ...(this.searchControl.value ? { q: this.searchControl.value } : {}),
    };
  }

  /** An unparseable year means no year filter, rather than a search that returns nothing. */
  private toVintageYear(value: string | null): number | null {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  }

  /** An unparseable or negative page is the first page, not an error the reader has to fix. */
  private toPage(value: string | null): number {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : 0;
  }

  /**
   * The public program filter is data-driven. Preserve any non-blank publisher program name from
   * a shared URL instead of validating against the curated Census/USGS compatibility enum.
   */
  private toProgramNames(values: readonly string[]): string[] {
    return values
      .map((value) => value.trim())
      .filter((value) => value.length > 0);
  }
}
