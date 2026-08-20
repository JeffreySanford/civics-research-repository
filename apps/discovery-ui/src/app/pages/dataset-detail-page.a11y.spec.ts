import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideMockStore } from '@ngrx/store/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { ResearchObjectDetailPage } from './dataset-detail-page';
import { expectNoAxeViolations } from '../testing/axe';
import {
  datasetsFeatureKey,
  initialDatasetsState,
} from '../state/datasets/datasets.reducer';

/**
 * Accessibility of a research object across the shapes it actually takes.
 *
 * <p>A dataset, a publication and a restricted object render different trees: the publication adds
 * authors, a DOI and a relations tab while dropping the map tabs; the restricted object adds a
 * warning and removes the file list. The browser suite scans one dataset, so the other two shapes
 * were unchecked.
 */
describe('ResearchObjectDetailPage accessibility', () => {
  const renderWith = async (datasets: object) => {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [ResearchObjectDetailPage],
      providers: [
        provideNoopAnimations(),
        provideRouter([]),
        provideMockStore({
          initialState: {
            [datasetsFeatureKey]: { ...initialDatasetsState, ...datasets },
          },
        }),
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(ResearchObjectDetailPage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  };

  const baseDetail = {
    source: 'REPOSITORY',
    id: 'tiger-line-north-dakota-2025',
    title: '2025 TIGER/Line - Census Tracts - North Dakota',
    program: 'TIGER_LINE',
    publisher: 'U.S. Census Bureau',
    abstractText: 'Census tract boundaries.',
    geography: 'North Dakota',
    vintageYear: 2025,
    releasedOn: '2025-09-22',
    files: [],
    citation: 'U.S. Census Bureau. 2025 TIGER/Line.',
    sourceUrl: 'https://www.census.gov/',
    relatedResearch: [],
    contentType: 'DATASET',
    accessLevel: 'PUBLIC',
  };

  it('is accessible while loading', async () => {
    const fixture = await renderWith({ loading: true, detail: null });

    await expectNoAxeViolations(fixture.nativeElement);
  });

  it('is accessible when the object failed to load', async () => {
    const fixture = await renderWith({
      loading: false,
      detail: null,
      error: 'Dataset detail failed to load.',
    });

    await expectNoAxeViolations(fixture.nativeElement);
  });

  /** Authors, a DOI link and a relations tab, with no map tabs. */
  it('is accessible as a publication with authors and relations', async () => {
    const fixture = await renderWith({
      loading: false,
      detail: {
        ...baseDetail,
        id: 'ces-wp-25-23-spatial-mismatch',
        title: 'Re-assessing the Spatial Mismatch Hypothesis',
        contentType: 'PUBLICATION',
        doi: '10.3386/w32252',
        license: 'Public domain. A work of the U.S. Government, 17 U.S.C. 105.',
        authors: [{ name: 'David Card' }, { name: 'Moises Yi' }],
        relations: [
          {
            verb: 'uses',
            targetId: 'lehd-microdata-restricted',
            targetTitle: 'LEHD microdata',
            targetType: 'DATASET',
            targetAccessLevel: 'RESTRICTED',
            note: 'Underlying records.',
          },
        ],
      },
    });

    await expectNoAxeViolations(fixture.nativeElement);
  });

  /** A restricted object carries a warning and no files; the warning has to be reachable. */
  it('is accessible as a restricted object', async () => {
    const fixture = await renderWith({
      loading: false,
      detail: {
        ...baseDetail,
        id: 'lehd-microdata-restricted',
        title: 'LEHD Longitudinal Employer-Household Dynamics microdata',
        contentType: 'DATASET',
        accessLevel: 'RESTRICTED',
        accessNote:
          'Access requires an approved research proposal through an FSRDC.',
        license: 'Restricted under Title 13, U.S. Code.',
        files: [],
      },
    });

    await expectNoAxeViolations(fixture.nativeElement);
  });
});
