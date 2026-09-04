import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideMockStore } from '@ngrx/store/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { AdminSyncPage } from './admin-sync-page';
import { expectNoAxeViolations } from '../testing/axe';
import { initialSyncState, syncFeatureKey } from '../state/sync/sync.reducer';
import { installMatchMediaStub } from '../testing/match-media';

/**
 * Accessibility of the admin sync page while it is working and when it fails.
 *
 * <p>Both of its spinners live in states the browser suite scans past: one while sync status loads,
 * one while a request runs. A progressbar with no accessible name is invisible to a screen reader
 * user precisely when the page is asking them to wait.
 */
describe('AdminSyncPage accessibility', () => {
  // The full local quality suite can put enough contention on jsdom/axe for an
  // otherwise passing scan to exceed 10 seconds. Keep the accessibility
  // assertion unchanged while allowing deterministic headroom on slower hosts.
  const AXE_TEST_TIMEOUT_MS = 20_000;

  beforeEach(() => {
    installMatchMediaStub();
  });

  const renderWith = async (sync: object) => {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [AdminSyncPage],
      providers: [
        provideNoopAnimations(),
        provideRouter([]),
        provideMockStore({
          initialState: {
            [syncFeatureKey]: { ...initialSyncState, ...sync },
          },
        }),
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(AdminSyncPage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  };

  it(
    'is accessible while loading sync status',
    async () => {
      const fixture = await renderWith({ loading: true });

      await expectNoAxeViolations(fixture.nativeElement);
    },
    AXE_TEST_TIMEOUT_MS,
  );

  it(
    'is accessible when a sync request failed',
    async () => {
      const fixture = await renderWith({
        loading: false,
        error: 'Sync request failed.',
      });

      await expectNoAxeViolations(fixture.nativeElement);
    },
    AXE_TEST_TIMEOUT_MS,
  );
});
