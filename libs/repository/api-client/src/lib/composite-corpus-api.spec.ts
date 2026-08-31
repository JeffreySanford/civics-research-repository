import { firstValueFrom, of } from 'rxjs';
import {
  RepositoryCompositeCorpusApi,
  type CompositeCorpusCaptureRequest,
  type CompositeCorpusManifest,
} from './composite-corpus-api';

describe('RepositoryCompositeCorpusApi', () => {
  const manifest: CompositeCorpusManifest = {
    compositionVersion: 'federated-composition/v1',
    mode: 'COMPOSITE_SNAPSHOT',
    corpusProfile: 'FEDERATED_1M',
    federatedRecordCount: 1_000_000,
    compositionSha256: 'c'.repeat(64),
    capturedAt: '2026-08-31T18:30:00Z',
    sources: [
      {
        sourceSystem: 'DATA_GOV',
        requestedRecordCount: 500_000,
        snapshotId: `DATA_GOV:${'a'.repeat(64)}`,
        runId: 'data-run-1',
        runAdapterVersion: 'data-gov-catalog-v4-v2',
        recordAdapterVersions: ['data-gov-catalog-v4-v2'],
        retainedRecordCount: 500_000,
        sha256: 'a'.repeat(64),
        snapshotCapturedAt: '2026-08-31T18:00:00Z',
      },
      {
        sourceSystem: 'DOE_OSTI',
        requestedRecordCount: 500_000,
        snapshotId: `DOE_OSTI:${'b'.repeat(64)}`,
        runId: 'osti-run-1',
        runAdapterVersion: 'doe-osti-v1',
        recordAdapterVersions: ['doe-osti-v1'],
        retainedRecordCount: 500_000,
        sha256: 'b'.repeat(64),
        snapshotCapturedAt: '2026-08-31T18:05:00Z',
      },
    ],
  };

  it('loads profile-scoped recent composition evidence with an explicit history bound', async () => {
    const http = { get: vi.fn(() => of([manifest])) };
    const api = new RepositoryCompositeCorpusApi(
      http as never,
      'http://api.test/api',
    );

    await expect(
      firstValueFrom(api.getRecentCompositeCorpusEvidence('FEDERATED_1M', 20)),
    ).resolves.toEqual([manifest]);

    expect(http.get).toHaveBeenCalledOnce();
    const [url, options] = http.get.mock.calls[0];
    expect(url).toBe('http://api.test/api/admin/federation/compositions');
    expect(options.params.toString()).toBe(
      'corpusProfile=FEDERATED_1M&limit=20',
    );
  });

  it('resolves one exact composition identity', async () => {
    const http = { get: vi.fn(() => of(manifest)) };
    const api = new RepositoryCompositeCorpusApi(
      http as never,
      'http://api.test/api',
    );

    await expect(
      firstValueFrom(
        api.getCompositeCorpusEvidence(manifest.compositionSha256),
      ),
    ).resolves.toBe(manifest);
    expect(http.get).toHaveBeenCalledWith(
      `http://api.test/api/admin/federation/compositions/${manifest.compositionSha256}`,
    );
  });

  it('captures only an explicit bounded-snapshot composition request', async () => {
    const request: CompositeCorpusCaptureRequest = {
      corpusProfile: 'FEDERATED_1M',
      sources: [
        {
          sourceSystem: 'DATA_GOV',
          requestedRecordCount: 500_000,
          snapshotId: `DATA_GOV:${'a'.repeat(64)}`,
        },
        {
          sourceSystem: 'DOE_OSTI',
          requestedRecordCount: 500_000,
          snapshotId: `DOE_OSTI:${'b'.repeat(64)}`,
        },
      ],
    };
    const http = { post: vi.fn(() => of(manifest)) };
    const api = new RepositoryCompositeCorpusApi(
      http as never,
      'http://api.test/api',
    );

    await expect(
      firstValueFrom(api.captureCompositeCorpusEvidence(request)),
    ).resolves.toBe(manifest);
    expect(http.post).toHaveBeenCalledWith(
      'http://api.test/api/admin/federation/compositions',
      request,
    );
  });
});
