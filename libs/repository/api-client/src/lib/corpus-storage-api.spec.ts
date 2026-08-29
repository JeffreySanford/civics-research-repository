import { firstValueFrom, of } from 'rxjs';
import {
  RepositoryCorpusStorageApi,
  type CorpusStorageMeasurement,
  type CorpusStorageOverview,
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
