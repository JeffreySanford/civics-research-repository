import { TestBed } from '@angular/core/testing';
import { provideMockActions } from '@ngrx/effects/testing';
import { provideMockStore } from '@ngrx/store/testing';
import { firstValueFrom, of, throwError, type Observable } from 'rxjs';
import { RepositoryAdminApi, type SyncJob } from 'repository-api-client';
import { SyncActions } from './sync.actions';
import { SyncEffects } from './sync.effects';
import { selectSelectedSyncSource } from './sync.selectors';

const job: SyncJob = {
  id: '92e0cc30-1f7f-49dd-babf-c3d13ce66b46',
  mode: 'DRY_RUN',
  source: 'TIGER_LINE',
  status: 'DRY_RUN_COMPLETE',
  startedAt: '2026-08-11T19:00:00Z',
  actions: [],
};

function setup(
  adminApi: Partial<RepositoryAdminApi>,
  actions$: Observable<unknown>,
  selectedSource: SyncJob['source'] = 'TIGER_LINE',
) {
  TestBed.configureTestingModule({
    providers: [
      SyncEffects,
      provideMockActions(() => actions$),
      provideMockStore({
        selectors: [
          { selector: selectSelectedSyncSource, value: selectedSource },
        ],
      }),
      { provide: RepositoryAdminApi, useValue: adminApi },
    ],
  });

  return TestBed.inject(SyncEffects);
}

describe('SyncEffects', () => {
  it.each([
    ['dryRunRequested', SyncActions.dryRunRequested(), 'DRY_RUN'],
    ['applyRequested', SyncActions.applyRequested(), 'APPLY'],
    ['diffRequested', SyncActions.diffRequested(), 'DIFF'],
  ] as const)(
    'translates %s into a sync request',
    async (_name, action, mode) => {
      const effects = setup({} as RepositoryAdminApi, of(action), 'LODES');
      const effect$ =
        mode === 'DRY_RUN'
          ? effects.requestDryRun$
          : mode === 'APPLY'
            ? effects.requestApply$
            : effects.requestDiff$;

      const emitted = await firstValueFrom(effect$);

      expect(emitted).toEqual(
        SyncActions.syncRequested({ mode, source: 'LODES' }),
      );
    },
  );

  it('starts a sync and reports the completed job', async () => {
    const startSync = vi.fn().mockReturnValue(of(job));
    const effects = setup(
      { startSync } as unknown as RepositoryAdminApi,
      of(SyncActions.syncRequested({ mode: 'APPLY', source: 'TIGER_LINE' })),
    );

    const emitted = await firstValueFrom(effects.runSync$);

    expect(startSync).toHaveBeenCalledWith({
      mode: 'APPLY',
      source: 'TIGER_LINE',
    });
    expect(emitted).toEqual(SyncActions.syncSucceeded({ job }));
  });

  it('reports a failed sync request without tearing down the effect', async () => {
    const startSync = vi
      .fn()
      .mockReturnValueOnce(
        throwError(() => new Error('DSpace is unavailable.')),
      )
      .mockReturnValueOnce(of(job));
    const effects = setup(
      { startSync } as unknown as RepositoryAdminApi,
      of(
        SyncActions.syncRequested({ mode: 'APPLY', source: 'TIGER_LINE' }),
        SyncActions.syncRequested({ mode: 'DIFF', source: 'TIGER_LINE' }),
      ),
    );

    const emitted: unknown[] = [];
    effects.runSync$.subscribe((action) => emitted.push(action));

    expect(emitted).toEqual([
      SyncActions.syncFailed({
        error: { code: 'UNKNOWN', message: 'DSpace is unavailable.' },
      }),
      SyncActions.syncSucceeded({ job }),
    ]);
  });

  it('uses a readable fallback message for a non-Error sync failure', async () => {
    const effects = setup(
      {
        startSync: vi.fn().mockReturnValue(throwError(() => ({ status: 503 }))),
      } as unknown as RepositoryAdminApi,
      of(SyncActions.syncRequested({ mode: 'APPLY', source: 'TIGER_LINE' })),
    );

    const emitted = await firstValueFrom(effects.runSync$);

    expect(emitted).toEqual(
      SyncActions.syncFailed({
        error: {
          code: 'SERVICE_UNAVAILABLE',
          message: 'Repository sync request failed.',
        },
      }),
    );
  });

  it('loads sync history', async () => {
    const effects = setup(
      {
        listSyncJobs: vi.fn().mockReturnValue(of([job])),
      } as unknown as RepositoryAdminApi,
      of(SyncActions.historyRequested()),
    );

    const emitted = await firstValueFrom(effects.loadHistory$);

    expect(emitted).toEqual(SyncActions.historyLoaded({ jobs: [job] }));
  });

  it('reports a history failure as a sync failure', async () => {
    const effects = setup(
      {
        listSyncJobs: vi
          .fn()
          .mockReturnValue(throwError(() => ({ status: 500 }))),
      } as unknown as RepositoryAdminApi,
      of(SyncActions.historyRequested()),
    );

    const emitted = await firstValueFrom(effects.loadHistory$);

    expect(emitted).toEqual(
      SyncActions.syncFailed({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Repository sync history failed to load.',
        },
      }),
    );
  });

  it('reindexes discovery projection', async () => {
    const projection = {
      source: 'REPOSITORY' as const,
      objectCount: 164,
      rebuiltAt: '2026-08-12T19:00:00Z',
    };
    const effects = setup(
      {
        reindexDiscovery: vi.fn().mockReturnValue(of(projection)),
      } as unknown as RepositoryAdminApi,
      of(SyncActions.reindexRequested()),
    );

    const emitted = await firstValueFrom(effects.runReindex$);

    expect(emitted).toEqual(SyncActions.reindexSucceeded({ projection }));
  });
});
