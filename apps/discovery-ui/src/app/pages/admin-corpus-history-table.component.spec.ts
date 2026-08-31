import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import type { CorpusStorageMeasurement } from 'repository-api-client';
import { AdminCorpusHistoryTableComponent } from './admin-corpus-history-table.component';

const measurement = (
  id: string,
  profile: CorpusStorageMeasurement['profile'],
  capturedAt: string,
  activeProjectionCount: number,
): CorpusStorageMeasurement => ({
  id,
  profile,
  topology: 'DOCKER_COMPOSE',
  activeProjectionCount,
  retainedFederatedCount: profile === 'CURATED_DEMO' ? 10_000 : 100_000,
  applicationPostgresBytes: 12_000 + activeProjectionCount,
  dspaceStoredBytes: 34_000,
  solrIndexBytes: 56_000 + activeProjectionCount,
  openSearchIndexBytes: 55_000 + activeProjectionCount,
  totalMeasuredLocalBytes: 157_000 + activeProjectionCount,
  capturedAt,
});

const configure = async () => {
  await TestBed.configureTestingModule({
    imports: [AdminCorpusHistoryTableComponent],
    providers: [provideNoopAnimations()],
  }).compileComponents();
};

describe('AdminCorpusHistoryTableComponent', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('renders sortable Material columns newest-first and filters rows', async () => {
    await configure();

    const fixture = TestBed.createComponent(AdminCorpusHistoryTableComponent);
    fixture.componentRef.setInput('history', [
      measurement('one', 'CURATED_DEMO', '2026-08-29T23:30:00Z', 187),
      measurement('two', 'FEDERATED_10K', '2026-08-30T23:30:00Z', 10_187),
    ]);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('table.mat-mdc-table')).not.toBeNull();
    expect(element.querySelectorAll('.mat-sort-header').length).toBe(10);
    expect(element.querySelector('mat-paginator')).not.toBeNull();

    let rows = element.querySelectorAll('tr.mat-mdc-row');
    expect(rows[0]?.textContent).toContain('Federated 10K');

    const input = element.querySelector<HTMLInputElement>(
      'input[aria-label="Filter historical measurements"]',
    );
    expect(input).not.toBeNull();
    input!.value = 'Curated demo';
    input!.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    rows = element.querySelectorAll('tr.mat-mdc-row');
    expect(rows.length).toBe(1);
    expect(rows[0]?.textContent).toContain('Curated demo');
    expect(rows[0]?.textContent).toContain('187');
  });

  it('paginates historical measurements at ten rows by default', async () => {
    await configure();

    const fixture = TestBed.createComponent(AdminCorpusHistoryTableComponent);
    fixture.componentRef.setInput(
      'history',
      Array.from({ length: 12 }, (_, index) =>
        measurement(
          `measurement-${index}`,
          'CURATED_DEMO',
          `2026-08-${String(index + 1).padStart(2, '0')}T23:30:00Z`,
          187 + index,
        ),
      ),
    );
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelectorAll('tr.mat-mdc-row').length).toBe(10);

    const nextPage = element.querySelector<HTMLButtonElement>(
      'button[aria-label="Next page"]',
    );
    expect(nextPage).not.toBeNull();
    nextPage!.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(element.querySelectorAll('tr.mat-mdc-row').length).toBe(2);
  });
});
