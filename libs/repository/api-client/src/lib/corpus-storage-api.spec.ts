import { firstValueFrom, of } from 'rxjs';
import {
  RepositoryCorpusStorageApi,
  type CorpusProfileActivationProgress,
  type CorpusStorageMeasurement,
  type CorpusStorageOverview,
  type DiscoveryProjectionState,
} from './corpus-storage-api';

describe('RepositoryCorpusStorageApi', () => {
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
        profile: 'FEDERATED_1M',
        label: 'Federated 1M',
        active: false,
        targetFederatedRecordCount: 1_000_000,
      },
    ],
    history: [measurement],
  };

  it('loads corpus profile and storage history', async () => {
    const http = { get: vi.fn(() => of(overview)) };
    const api = new RepositoryCorpusStorageApi(
      http as never,
      'http://api.test/api',
    );

    await expect(firstValueFrom(api.getCorpusStorageOverview())).resolves.toBe(
      overview,
    );
    expect(http.get).toHaveBeenCalledWith(
      'http://api.test/api/admin/corpus/storage',
    );
  });

  it('activates a named corpus profile through the guarded reindex endpoint', async () => {
    const projection: DiscoveryProjectionState = {
      source: 'REPOSITORY',
      objectCount: 10_181,
      projectionId: 'b'.repeat(64),
    };
    const http = { post: vi.fn(() => of(projection)) };
    const api = new RepositoryCorpusStorageApi(
      http as never,
      'http://api.test/api',
    );

    await expect(
      firstValueFrom(api.activateCorpusProfile('FEDERATED_10K')),
    ).resolves.toBe(projection);
    expect(http.post).toHaveBeenCalledWith(
      'http://api.test/api/admin/reindex',
      null,
      { params: { profile: 'FEDERATED_10K' } },
    );
  });

  it('polls exact backend activation progress', async () => {
    const progress: CorpusProfileActivationProgress = {
      operationId: 'activation-1',
      profile: 'FEDERATED_100K',
      phase: 'PROJECTING',
      processedDocuments: 42_000,
      totalDocuments: 100_181,
      percentComplete: 41,
      startedAt: '2026-08-30T23:30:00Z',
      updatedAt: '2026-08-30T23:30:05Z',
      elapsedMs: 5_000,
      documentsPerSecond: 8_400,
      message: 'Building Solr and OpenSearch projections.',
    };
    const http = { get: vi.fn(() => of(progress)) };
    const api = new RepositoryCorpusStorageApi(
      http as never,
      'http://api.test/api',
    );

    await expect(
      firstValueFrom(api.getCorpusProfileActivationProgress()),
    ).resolves.toBe(progress);
    expect(http.get).toHaveBeenCalledWith(
      'http://api.test/api/admin/reindex/progress',
    );
  });

  it('captures the currently active corpus footprint without accepting a profile argument', async () => {
    const http = { post: vi.fn(() => of(measurement)) };
    const api = new RepositoryCorpusStorageApi(
      http as never,
      'http://api.test/api',
    );

    await expect(firstValueFrom(api.captureCorpusStorage())).resolves.toBe(
      measurement,
    );
    expect(http.post).toHaveBeenCalledWith(
      'http://api.test/api/admin/corpus/storage/capture',
      null,
    );
  });
});
