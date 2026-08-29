import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { of } from 'rxjs';
import {
  RepositoryCorpusStorageApi,
  type CorpusStorageMeasurement,
  type CorpusStorageOverview,
} from 'repository-api-client';
import { AdminCorpusStorageComponent } from './admin-corpus-storage.component';

const measurement: CorpusStorageMeasurement = {
  id: 'measurement-1',
  profile: 'CURATED_DEMO',
  topology: 'DOCKER_COMPOSE',
  activeProjectionCount: 181,
  retainedFederatedCount: 0,
  projectionId: 'a'.repeat(64),
  applicationPostgresBytes: 12_000,
  dspaceStoredBytes: 34_000,
  solrIndexBytes: 56_000,
  totalMeasuredLocalBytes: 102_000,
  capturedAt: '2026-08-29T23:30:00Z',
};

const overview: CorpusStorageOverview = {
  activeProfile: 'CURATED_DEMO',
  profiles: [
    {
      profile: 'CURATED_DEMO',
      label: 'Curated demo',
      active: true,
      latestMeasurement: measurement,
    },
    {
      profile: 'FEDERATED_10K',
      label: 'Federated 10K',
      active: false,
      targetFederatedRecordCount: 10_000,
    },
    {
      profile: 'FEDERATED_100K',
      label: 'Federated 100K',
      active: false,
      targetFederatedRecordCount: 100_000,
    },
    {
      profile: 'FEDERATED_1M',
      label: 'Federated 1M',
      active: false,
      targetFederatedRecordCount: 1_000_000,
    },
    { profile: 'FULL', label: 'Full source bounds', active: false },
  ],
  history: [measurement],
};

describe('AdminCorpusStorageComponent', () => {
  const render = async () => {
    const api = {
      getCorpusStorageOverview: vi.fn(() => of(overview)),
      captureCorpusStorage: vi.fn(() => of(measurement)),
    };

    await TestBed.configureTestingModule({
      imports: [AdminCorpusStorageComponent],
      providers: [
        provideNoopAnimations(),
        { provide: RepositoryCorpusStorageApi, useValue: api },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(AdminCorpusStorageComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return { fixture, api };
  };

  afterEach(() => TestBed.resetTestingModule());

  it('separates the active projection profile from the profile being viewed', async () => {
    const { fixture } = await render();

    expect(fixture.nativeElement.textContent).toContain(
      'Corpus scale & local storage',
    );
    expect(fixture.nativeElement.textContent).toContain(
      'Active search profile Curated demo',
    );
    expect(fixture.nativeElement.textContent).toContain('Known measured total');

    fixture.componentInstance.selectProfile('FEDERATED_1M');
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Federated 1M');
    expect(fixture.nativeElement.textContent).toContain('1,000,000');
    expect(fixture.nativeElement.textContent).toContain('Not measured yet');
    expect(fixture.nativeElement.textContent).toContain(
      'Viewing this profile does not activate it',
    );
  });

  it('captures only the current active footprint and refreshes history', async () => {
    const { fixture, api } = await render();

    fixture.componentInstance.captureCurrentFootprint();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(api.captureCorpusStorage).toHaveBeenCalledTimes(1);
    expect(api.getCorpusStorageOverview).toHaveBeenCalledTimes(2);
    expect(fixture.nativeElement.textContent).toContain(
      'Current footprint captured',
    );
  });
});
