import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import {
  RepositoryAdminApi,
  RepositoryCorpusStorageApi,
  RepositoryEvidenceApi,
  RepositorySearchComparisonApi,
} from 'repository-api-client';
import { RepositoryStewardPage } from './repository-steward-page';

const corpusOverview = {
  activeProfile: 'FEDERATED_1M',
  profiles: [
    {
      profile: 'FEDERATED_1M',
      label: 'Federated 1M',
      active: true,
      targetFederatedRecordCount: 1_000_000,
    },
  ],
  history: [
    {
      profile: 'FEDERATED_1M',
      topology: 'COMPOSE',
      databaseBytes: 1,
      searchIndexBytes: 1,
      archiveBytes: 1,
      capturedAt: '2026-09-12T15:00:00Z',
    },
  ],
};

const projection = {
  source: 'REPOSITORY',
  objectCount: 1_000_181,
  projectionId:
    'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  rebuiltAt: '2026-09-12T15:00:00Z',
};

const comparison = {
  projection,
  sameProjection: true,
  solr: {
    engine: 'SOLR',
    enabled: true,
    reachable: true,
    indexName: 'discovery',
    indexedDocumentCount: 1_000_181,
    elapsedMs: 4,
  },
  openSearch: {
    engine: 'OPENSEARCH',
    enabled: true,
    reachable: true,
    indexName: 'discovery-comparison',
    indexedDocumentCount: 1_000_181,
    elapsedMs: 5,
  },
};

const dspaceOverview = {
  reachable: true,
  readEnabled: true,
  writeEnabled: false,
  itemCount: 181,
  communityCount: 1,
  collectionCount: 6,
  statusMessage: 'DSpace is reachable for repository discovery.',
};

const sourceInventory = {
  checkedAt: '2026-09-12T14:30:00Z',
  objectCount: 181,
  programCount: 6,
  distinctFileCount: 191,
  measuredFileCount: 191,
  unreachableFileCount: 0,
  totalBytes: 1_848_988_848,
  byProgram: [],
};

const syncJobs = [
  {
    id: '11111111-1111-4111-8111-111111111111',
    mode: 'APPLY',
    source: 'TIGER_LINE',
    status: 'APPLIED',
    startedAt: '2026-09-12T14:00:00Z',
    completedAt: '2026-09-12T14:00:05Z',
    actions: [],
  },
];

const accessibilityEvidence = [
  {
    id: 'wcag-current',
    workflow: 'Browser Evidence',
    status: 'AUTOMATED_PASS',
    standard: 'WCAG_2_2_AA',
    capturedAt: '2026-09-12T15:10:00Z',
  },
];

const searchEvidence = {
  profile: 'FEDERATED_1M',
  capturedAt: '2026-09-12T15:05:00Z',
  scope: 'LOCAL_CERTIFIED_TOPOLOGY_ONLY',
  comparativeClaimAllowed: false,
  projectionId: projection.projectionId,
  projectionObjectCount: 1_000_181,
};

describe('RepositoryStewardPage', () => {
  const render = async (options?: { degraded?: boolean; empty?: boolean }) => {
    const degraded = options?.degraded ?? false;
    const empty = options?.empty ?? false;

    const unavailable = () => throwError(() => new Error('unavailable'));

    const adminApi = {
      getDiscoveryProjectionState: vi.fn(() =>
        degraded ? unavailable() : of(projection),
      ),
      getDspaceOverview: vi.fn(() =>
        degraded ? unavailable() : of(dspaceOverview),
      ),
      getSourceInventory: vi.fn(() =>
        degraded ? unavailable() : of(sourceInventory),
      ),
      listSyncJobs: vi.fn(() =>
        degraded ? unavailable() : of(empty ? [] : syncJobs),
      ),
    };

    const corpusApi = {
      getCorpusStorageOverview: vi.fn(() =>
        degraded ? unavailable() : of(corpusOverview),
      ),
    };

    const evidenceApi = {
      listAccessibilityEvidence: vi.fn(() =>
        degraded ? unavailable() : of(empty ? [] : accessibilityEvidence),
      ),
      getSearchPerformanceEvidence: vi.fn(() =>
        degraded ? unavailable() : of(searchEvidence),
      ),
    };

    const comparisonApi = {
      run: vi.fn(() => (degraded ? unavailable() : of(comparison))),
    };

    await TestBed.configureTestingModule({
      imports: [RepositoryStewardPage],
      providers: [
        { provide: RepositoryAdminApi, useValue: adminApi },
        { provide: RepositoryCorpusStorageApi, useValue: corpusApi },
        { provide: RepositoryEvidenceApi, useValue: evidenceApi },
        { provide: RepositorySearchComparisonApi, useValue: comparisonApi },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(RepositoryStewardPage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  };

  afterEach(() => TestBed.resetTestingModule());

  it('composes existing read-only status evidence without mutation controls', async () => {
    const fixture = await render();
    const element = fixture.nativeElement as HTMLElement;
    const text = element.textContent ?? '';

    expect(text).toContain('Read-only repository status');
    expect(text).toContain('FEDERATED_1M');
    expect(text).toContain('Projection parity verified');
    expect(text).toContain('OpenSearch');
    expect(text).toContain('DSpace is reachable for repository discovery.');
    expect(text).toContain('TIGER_LINE');
    expect(text).toContain('WCAG_2_2_AA');
    expect(text).toContain('LOCAL_CERTIFIED_TOPOLOGY_ONLY');
    expect(element.querySelectorAll('button')).toHaveLength(0);
  });

  it('shows explicit empty states without inventing operational activity', async () => {
    const fixture = await render({ empty: true });
    const text = fixture.nativeElement.textContent as string;

    expect(text).toContain('No synchronization jobs are recorded.');
    expect(text).toContain('No retained accessibility evidence is available.');
  });

  it('fails each status area soft when read-only APIs are unavailable', async () => {
    const fixture = await render({ degraded: true });
    const text = fixture.nativeElement.textContent as string;

    expect(text).toContain('Corpus profile and storage evidence are unavailable.');
    expect(text).toContain('Projection metadata is unavailable.');
    expect(text).toContain('Search-target liveness and parity are unavailable.');
    expect(text).toContain('DSpace status is unavailable from the repository API.');
    expect(text).toContain('Source inventory is unavailable from the repository API.');
    expect(text).toContain('Recent synchronization history is unavailable.');
    expect(text).toContain('Retained accessibility evidence is unavailable.');
    expect(text).toContain('Certified search research evidence is unavailable.');
  });
});
