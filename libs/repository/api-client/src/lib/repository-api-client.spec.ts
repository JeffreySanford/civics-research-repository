import { firstValueFrom, of } from 'rxjs';
import { RepositoryAdminApi, type SyncJob } from './repository-api-client';

describe('RepositoryAdminApi', () => {
  it('starts a typed sync job and lists history', async () => {
    const job: SyncJob = {
      id: '92e0cc30-1f7f-49dd-babf-c3d13ce66b46',
      mode: 'DRY_RUN',
      source: 'TIGER_LINE',
      status: 'DRY_RUN_COMPLETE',
      startedAt: '2026-08-11T19:00:00Z',
      actions: [],
    };
    const http = {
      post: vi.fn(() => of(job)),
      get: vi.fn(() => of([job])),
    };
    const api = new RepositoryAdminApi(http as never, 'http://api.test/api');

    api
      .startSync({ mode: 'DRY_RUN', source: 'TIGER_LINE' })
      .subscribe((sync) => {
        expect(sync).toBe(job);
      });

    expect(http.post).toHaveBeenCalledWith('http://api.test/api/admin/sync', {
      mode: 'DRY_RUN',
      source: 'TIGER_LINE',
    });

    await expect(firstValueFrom(api.listSyncJobs())).resolves.toEqual([job]);
    expect(http.get).toHaveBeenCalledWith('http://api.test/api/admin/sync');
  });
});
