import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { Observable, Subject, of } from 'rxjs';
import {
  RepositoryCorpusStorageApi,
  type CorpusProfileActivationProgress,
  type CorpusStorageMeasurement,
  type CorpusStorageOverview,
  type DiscoveryProjectionState,
} from 'repository-api-client';
import { AdminCorpusStorageComponent } from './admin-corpus-storage.component';

const measurement: CorpusStorageMeasurement = {
  id: 'measurement-1',
  profile: 'CURATED_DEMO',
  topology: 'DOCKER_COMPOSE',
  activeProjectionCount: 187,
  retainedFederatedCount: 10_000,
  projectionId: 'a'.repeat(64),
  applicationPostgresBytes: 12_000,
  dspaceStoredBytes: 34_000,
  solrIndexBytes: 56_000,
  totalMeasuredLocalBytes: 102_000,
  capturedAt: '2026-08-29T23:30:00Z',
};

const projection: DiscoveryProjectionState = {
  source: 'REPOSITORY',
  objectCount: 10_187,
  projectionId: 'b'.repeat(64),
};

const progress: CorpusProfileActivationProgress = {
  operationId: 'activation-1',
  profile: 'FEDERATED_10K',
  phase: 'PROJECTING',
  processedDocuments: 4_000,
  totalDocuments: 10_187,
  percentComplete: 39,
  startedAt: '2026-08-30T23:30:00Z',
  updatedAt: '2026-08-30T23:30:01Z',
  elapsedMs: 1_000,
  documentsPerSecond: 4_000,
  message: 'Building Solr and OpenSearch projections.',
};

const scaleStarted: CorpusProfileActivationProgress = {
  operationId: 'scale-100k',
  profile: 'FEDERATED_100K',
  phase: 'HARVESTING',
  processedDocuments: 10_000,
  totalDocuments: 100_000,
  percentComplete: 10,
  startedAt: '2026-08-31T00:40:00Z',
  updatedAt: '2026-08-31T00:40:01Z',
  elapsedMs: 1_000,
  documentsPerSecond: 100,
  message: 'Harvesting and retaining federated metadata from the authoritative source.',
};

const scaleCompleted: CorpusProfileActivationProgress = {
  ...scaleStarted,
  phase: 'COMPLETED',
  processedDocuments: 100_187,
  totalDocuments: 100_187,
  percentComplete: 100,
  completedAt: '2026-08-31T00:45:00Z',
  updatedAt: '2026-08-31T00:45:00Z',
  elapsedMs: 300_000,
  documentsPerSecond: 334,
  message:
    'Corpus profile growth, verified projection, and storage evidence capture completed.',
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
  const render = async (
    activation$: Observable<DiscoveryProjectionState> = of(projection),
    activationProgress$: Observable<CorpusProfileActivationProgress> = of(
      progress,
    ),
  ) => {
    const api = {
      getCorpusStorageOverview: vi.fn(() => of(overview)),
      activateCorpusProfile: vi.fn(() => activation$),
      startCorpusProfileScale: vi.fn(() => of(scaleStarted)),
      getCorpusProfileActivationProgress: vi.fn(() => activationProgress$),
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
    expect(fixture.nativeElement.textContent).toMatch(
      /Active search profile\s*Curated demo/,
    );
    expect(fixture.nativeElement.textContent).toContain('Known measured total');

    fixture.componentInstance.selectProfile('FEDERATED_1M');
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Federated 1M');
    expect(fixture.nativeElement.textContent).toContain('1,000,000');
    expect(fixture.nativeElement.textContent).toContain('Not measured yet');
    expect(fixture.nativeElement.textContent).toContain(
      'Selecting a profile does not activate it',
    );
    expect(fixture.nativeElement.textContent).toContain('Not available yet');
    expect(fixture.nativeElement.textContent).toContain(
      'the current corpus has 10,000',
    );
  });

  it('offers guarded growth for 100k while keeping 1m unavailable', async () => {
    const { fixture } = await render();

    fixture.componentInstance.selectProfile('FEDERATED_100K');
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain(
      'Ready for guarded growth',
    );
    expect(fixture.nativeElement.textContent).toContain(
      'Grow & activate Federated 100K',
    );

    fixture.componentInstance.selectProfile('FEDERATED_1M');
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Not available yet');
    expect(fixture.nativeElement.textContent).not.toContain(
      'Grow & activate Federated 1M',
    );
  });

  it('activates an already-retained profile, captures its footprint, and refreshes evidence', async () => {
    const { fixture, api } = await render();

    fixture.componentInstance.selectProfile('FEDERATED_10K');
    fixture.componentInstance.activateProfile('FEDERATED_10K');
    await fixture.whenStable();
    fixture.detectChanges();

    expect(api.activateCorpusProfile).toHaveBeenCalledWith('FEDERATED_10K');
    expect(api.captureCorpusStorage).toHaveBeenCalledTimes(1);
    expect(api.getCorpusStorageOverview).toHaveBeenCalledTimes(2);
    expect(fixture.nativeElement.textContent).toContain(
      'Federated 10K activated with 10,187 searchable documents',
    );
  });

  it('renders exact backend progress while a profile activation is running', async () => {
    const activationSubject = new Subject<DiscoveryProjectionState>();
    const { fixture, api } = await render(activationSubject.asObservable());

    fixture.componentInstance.selectProfile('FEDERATED_10K');
    fixture.componentInstance.activateProfile('FEDERATED_10K');
    fixture.detectChanges();
    await new Promise((resolve) => setTimeout(resolve, 10));
    fixture.detectChanges();

    expect(api.getCorpusProfileActivationProgress).toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain(
      'Loading search indexes',
    );
    expect(fixture.nativeElement.textContent).toContain(
      '4,000 / 10,187 documents',
    );
    expect(fixture.nativeElement.textContent).toContain('39%');
    expect(fixture.nativeElement.textContent).toContain('4,000 docs/s');

    activationSubject.next(projection);
    activationSubject.complete();
    await new Promise((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();
  });

  it('starts 100k growth asynchronously and completes from backend progress', async () => {
    const { fixture, api } = await render(of(projection), of(scaleCompleted));

    fixture.componentInstance.selectProfile('FEDERATED_100K');
    fixture.componentInstance.scaleProfile('FEDERATED_100K');
    fixture.detectChanges();
    await new Promise((resolve) => setTimeout(resolve, 10));
    fixture.detectChanges();

    expect(api.startCorpusProfileScale).toHaveBeenCalledWith('FEDERATED_100K');
    expect(api.getCorpusProfileActivationProgress).toHaveBeenCalled();
    expect(api.getCorpusStorageOverview).toHaveBeenCalledTimes(2);
    expect(fixture.nativeElement.textContent).toContain(
      'Federated 100K growth and activation completed',
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
