import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideMockStore } from '@ngrx/store/testing';
import type {
  ResearchArtifactVersion,
  ResearchObjectDetail,
  VersionHistoryStatus,
} from 'repository-api-client';
import {
  datasetsFeatureKey,
  initialDatasetsState,
} from '../state/datasets/datasets.reducer';
import { ResearchObjectDetailPage } from './dataset-detail-page';

const detail = {
  source: 'REPOSITORY',
  origin: 'REPOSITORY',
  sourceSystem: 'CENSUS',
  id: 'version-history-example',
  title: 'Version history example',
  program: 'OTHER',
  publisher: 'Example Federal Publisher',
  abstractText:
    'Fixture used only to prove version-history presentation semantics.',
  files: [],
  citation: 'Version history example.',
  sourceUrl: 'https://example.gov/research/version-history-example',
  relatedResearch: [],
  contentType: 'DATASET',
  accessLevel: 'PUBLIC',
} as ResearchObjectDetail;

const currentVersion: ResearchArtifactVersion = {
  id: 'version-history-example-current',
  label: 'Observed release 2025.2',
  releasedOn: '2025-09-01',
  current: true,
  versionLabel: '2025.2',
  sourceUrl: 'https://example.gov/research/version-history-example/2025.2',
};

async function renderVersionHistory(
  status: VersionHistoryStatus,
  versions: readonly ResearchArtifactVersion[],
): Promise<ComponentFixture<ResearchObjectDetailPage>> {
  TestBed.resetTestingModule();
  await TestBed.configureTestingModule({
    imports: [ResearchObjectDetailPage],
    providers: [
      provideNoopAnimations(),
      provideRouter([]),
      provideMockStore({
        initialState: {
          [datasetsFeatureKey]: {
            ...initialDatasetsState,
            detail,
            versions,
            versionHistoryStatus: status,
          },
        },
      }),
    ],
  }).compileComponents();

  const fixture = TestBed.createComponent(ResearchObjectDetailPage);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();

  const tabs = Array.from(
    fixture.nativeElement.querySelectorAll(
      '[role="tab"]',
    ) as NodeListOf<HTMLElement>,
  );
  const versionsTab = tabs.find(
    (tab) => tab.textContent?.trim() === 'Versions',
  );
  expect(versionsTab).toBeTruthy();
  versionsTab?.click();
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return fixture;
}

describe('ResearchObjectDetailPage version-history semantics', () => {
  it('states that broader history is unknown when only the current record was observed', async () => {
    const fixture = await renderVersionHistory('OBSERVED_CURRENT_ONLY', [
      currentVersion,
    ]);
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain(
      'Only the current repository/source record has been observed. Earlier or later version history is not established.',
    );
    expect(text).toContain('Observed release 2025.2');
    expect(text).toContain('Current observed record');
    expect(text).not.toContain('TIGER_LINE 2024');
  });

  it('renders multiple versions only when history is explicitly available', async () => {
    const priorVersion: ResearchArtifactVersion = {
      id: 'version-history-example-prior',
      label: 'Observed release 2025.1',
      releasedOn: '2025-06-01',
      current: false,
      versionLabel: '2025.1',
      sourceUrl: 'https://example.gov/research/version-history-example/2025.1',
    };
    const fixture = await renderVersionHistory('HISTORY_AVAILABLE', [
      currentVersion,
      priorVersion,
    ]);
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain(
      'The repository has observed version-lineage records for this research artifact.',
    );
    expect(text).toContain('Observed release 2025.2');
    expect(text).toContain('Observed release 2025.1');
  });

  it('states that provenance is unavailable instead of inferring history', async () => {
    const fixture = await renderVersionHistory('UNAVAILABLE', []);
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain(
      'Version provenance is not available for this research artifact.',
    );
    expect(text).not.toContain('Current observed record');
  });
});
