import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { of } from 'rxjs';
import { RepositoryCorpusStorageApi } from 'repository-api-client';
import { expectNoAxeViolations } from '../testing/axe';
import { AdminCorpusStorageComponent } from './admin-corpus-storage.component';

describe('AdminCorpusStorageComponent accessibility', () => {
  it('has no axe violations with measured and planned corpus profiles', async () => {
    await TestBed.configureTestingModule({
      imports: [AdminCorpusStorageComponent],
      providers: [
        provideNoopAnimations(),
        {
          provide: RepositoryCorpusStorageApi,
          useValue: {
            getCorpusStorageOverview: () =>
              of({
                activeProfile: 'CURATED_DEMO',
                profiles: [
                  {
                    profile: 'CURATED_DEMO',
                    label: 'Curated demo',
                    active: true,
                    latestMeasurement: {
                      id: 'measurement-1',
                      profile: 'CURATED_DEMO',
                      topology: 'DOCKER_COMPOSE',
                      activeProjectionCount: 181,
                      retainedFederatedCount: 0,
                      applicationPostgresBytes: 12_000,
                      dspaceStoredBytes: 34_000,
                      solrIndexBytes: 56_000,
                      totalMeasuredLocalBytes: 102_000,
                      capturedAt: '2026-08-29T23:30:00Z',
                    },
                  },
                  {
                    profile: 'FEDERATED_1M',
                    label: 'Federated 1M',
                    active: false,
                    targetFederatedRecordCount: 1_000_000,
                  },
                ],
                history: [],
              }),
            captureCorpusStorage: vi.fn(),
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(AdminCorpusStorageComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    await expectNoAxeViolations(fixture.nativeElement);
  });
});
