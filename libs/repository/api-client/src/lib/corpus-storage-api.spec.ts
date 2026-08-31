import { firstValueFrom, of } from 'rxjs';
import {
  RepositoryCorpusStorageApi,
  type CorpusProfileActivationProgress,
  type CorpusScaleEvidenceReport,
  type CorpusStorageMeasurement,
  type CorpusStorageOverview,
} from './corpus-storage-api';
import type { DiscoveryProjectionState } from './repository-api-client';

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

  it('starts guarded corpus growth without holding the scale request open', async () => {
    const progress: CorpusProfileActivationProgress = {
      operationId: 'scale-100k',
      profile: 'FEDERATED_100K',
      phase: 'HARVESTING',
      processedDocuments: 10_000,
      totalDocuments: 100_000,
      percentComplete: 10,
      updatedAt: '2026-08-31T00:40:00Z',
      elapsedMs: 25,
      message:
        'Harvesting and retaining federated metadata from the authoritative source.',
    };
    const http = { post: vi.fn(() => of(progress)) };
    const api = new RepositoryCorpusStorageApi(
      http as never,
      'http://api.test/api',
    );

    await expect(
      firstValueFrom(api.startCorpusProfileScale('FEDERATED_100K')),
    ).resolves.toBe(progress);
    expect(http.post).toHaveBeenCalledWith(
      'http://api.test/api/admin/corpus/scale',
      null,
      { params: { profile: 'FEDERATED_100K' } },
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

  it('loads read-only evidence for a named corpus profile', async () => {
    const evidence: CorpusScaleEvidenceReport = {
      profile: 'FEDERATED_100K',
      valid: true,
      targetFederatedRecordCount: 100_000,
      retainedFederatedRecordCount: 100_000,
      activeProfile: 'FEDERATED_100K',
      activationProjectionObjectCount: 100_181,
      activationProjectionId: 'c'.repeat(64),
      currentProjectionObjectCount: 100_181,
      currentProjectionId: 'c'.repeat(64),
      targetParity: true,
      storageEvidencePresent: true,
      storageProjectionObjectCount: 100_181,
      storageRetainedFederatedCount: 100_000,
      storageProjectionId: 'c'.repeat(64),
      storageCapturedAt: '2026-08-31T01:11:17Z',
      violations: [],
    };
    const http = { get: vi.fn(() => of(evidence)) };
    const api = new RepositoryCorpusStorageApi(
      http as never,
      'http://api.test/api',
    );

    await expect(
      firstValueFrom(api.getCorpusScaleEvidence('FEDERATED_100K')),
    ).resolves.toBe(evidence);
    expect(http.get).toHaveBeenCalledWith(
      'http://api.test/api/admin/corpus/scale/evidence',
      { params: { profile: 'FEDERATED_100K' } },
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
