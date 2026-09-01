import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import {
  RepositoryAdminApi,
  RepositoryCorpusStorageApi,
  type CorpusStorageOverview,
  type DiscoveryProjectionState,
} from 'repository-api-client';
import { ActiveCorpusIdentityComponent } from './active-corpus-identity.component';

const overview: CorpusStorageOverview = {
  activeProfile: 'FEDERATED_1M',
  profiles: [
    {
      profile: 'FEDERATED_1M',
      label: 'Federated 1M',
      active: true,
      targetFederatedRecordCount: 1_000_000,
    },
  ],
  history: [],
};

const projection: DiscoveryProjectionState = {
  source: 'REPOSITORY',
  objectCount: 1_000_181,
  projectionId:
    '3d461a9feb49f7239f3f6aaacb0c90f1ff43d0c683238acc2202c841154db44d',
};

describe('ActiveCorpusIdentityComponent', () => {
  const render = async (
    storageApi = { getCorpusStorageOverview: vi.fn(() => of(overview)) },
    adminApi = { getDiscoveryProjectionState: vi.fn(() => of(projection)) },
  ) => {
    await TestBed.configureTestingModule({
      imports: [ActiveCorpusIdentityComponent],
      providers: [
        { provide: RepositoryCorpusStorageApi, useValue: storageApi },
        { provide: RepositoryAdminApi, useValue: adminApi },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(ActiveCorpusIdentityComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  };

  afterEach(() => TestBed.resetTestingModule());

  it('shows the live 1m projection and exact C2 recipe', async () => {
    const fixture = await render();
    const text = fixture.nativeElement.textContent;

    expect(text).toContain('Search corpus');
    expect(text).toContain('Federated 1M');
    expect(text).toContain('1,000,181 documents');
    expect(text).toContain('C2 exact · 500K Data.gov + 500K DOE OSTI');
    expect(text).toContain('projection 3d461a9feb49…');
  });

  it('fails soft when corpus identity metadata cannot be loaded', async () => {
    const fixture = await render(
      {
        getCorpusStorageOverview: vi.fn(() =>
          throwError(() => new Error('unavailable')),
        ),
      },
      { getDiscoveryProjectionState: vi.fn(() => of(projection)) },
    );

    expect(fixture.nativeElement.textContent.trim()).toBe('');
  });
});
