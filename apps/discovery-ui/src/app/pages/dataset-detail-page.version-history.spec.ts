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

const checksum =
  '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

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
  subjects: ['Version provenance'],
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
  versionDate: '2025-08-29',
  sourceSha256: checksum,
  capturedAt: '2026-09-12T18:45:00-05:00',
  isVersionOf: 'version-history-example',
  changeNote: 'Publisher-issued metadata revision.',
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
  it('renders observed provenance while stating broader history remains unknown', async () => {
    const fixture = await renderVersionHistory('OBSERVED_CURRENT_ONLY', [
      currentVersion,
    ]);
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain(
      'Only the current repository/source record has been observed. Earlier or later version history is not established.',
    );
    expect(text).toContain('Authority and evidence trail');
    expect(text).toContain('DSpace curated repository record');
    expect(text).toContain('Derived projections only');
    expect(text).toContain('Observed release 2025.2');
    expect(text).toContain('Current observed record');
    expect(text).toContain('Source version');
    expect(text).toContain('2025.2');
    expect(text).toContain('Version date');
    expect(text).toContain('Source SHA-256');
    expect(text).toContain(checksum);
    expect(text).toContain('Provenance captured');
    expect(text).toContain('Version of');
    expect(text).toContain('version-history-example');
    expect(text).toContain('Publisher-issued metadata revision.');
    expect(text).toContain('What this record proves');
    expect(text).toContain('Fixity:');
    expect(text).toContain('Capture:');
    expect(text).toContain('Lineage:');
    expect(text).toContain('Not established');
    expect(text).not.toContain('TIGER_LINE 2024');
  });

  it('renders DSpace-native current and prior lineage only when history is explicitly available', async () => {
    const priorVersion: ResearchArtifactVersion = {
      id: 'dspace-version:101',
      label: 'Version history example',
      releasedOn: '2025-09-01',
      current: false,
      versionLabel: 'Repository version 1',
      versionDate: '2026-08-13',
      isVersionOf: 'version-history-example',
      sourceUrl: 'https://example.gov/research/version-history-example/2025.2',
    };
    const fixture = await renderVersionHistory('HISTORY_AVAILABLE', [
      {
        ...currentVersion,
        id: 'dspace-version:102',
        label: 'Version history example',
        versionLabel: 'Repository version 2',
        versionDate: '2026-09-13',
        isVersionOf: 'version-history-example',
        supersedes: priorVersion.id,
        changeNote: 'Phase C observed DSpace lineage proof',
      },
      priorVersion,
    ]);
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain(
      'The repository has observed version-lineage records for this research artifact.',
    );
    expect(text).toContain('Observed multi-version lineage');
    expect(text).toContain('DSpace native item version history');
    expect(text).toContain('Current repository version');
    expect(text).toContain('Repository version');
    expect(text).toContain('Repository version 2');
    expect(text).toContain('Repository version 1');
    expect(text).toContain('Supersedes');
    expect(text).toContain('dspace-version:101');
    expect(text).toContain('Phase C observed DSpace lineage proof');
    expect(text).toContain(
      'Prior repository version is established by the observed DSpace version history.',
    );
    expect(text).toContain(
      'Established from observed DSpace-native version-lineage records.',
    );
  });

  it('states that provenance is unavailable instead of inferring history', async () => {
    const fixture = await renderVersionHistory('UNAVAILABLE', []);
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain(
      'Version provenance is not available for this research artifact.',
    );
    expect(text).toContain('Authority and evidence trail');
    expect(text).toContain('Version provenance unavailable');
    expect(text).not.toContain('Current observed record');
    expect(text).not.toContain('Source SHA-256');
    expect(text).not.toContain('What this record proves');
  });
});
