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

describe('AdminCorpusHistoryTableComponent', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('renders a Material table with sortable columns, filtering, and pagination', async () => {
    await TestBed.configureTestingModule({
      imports: [AdminCorpusHistoryTableComponent],
      providers: [provideNoopAnimations()],
    }).compileComponents();

    const fixture = TestBed.createComponent(AdminCorpusHistoryTableComponent);
    fixture.componentRef.setInput('history', [
      measurement('one', 'CURATED_DEMO', '2026-08-29T23:30:00Z', 187),
      measurement('two', 'FEDERATED_10K', '2026-08-30T23:30:00Z', 10_187),
    ]);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('table[mat-table]')).not.toBeNull();
    expect(element.querySelectorAll('[mat-sort-header]').length).toBe(10);
    expect(element.querySelector('mat-paginator')).not.toBeNull();

    const input = element.querySelector<HTMLInputElement>(
      'input[aria-label="Filter historical measurements"]',
    );
    expect(input).not.toBeNull();
    input!.value = 'Federated 10K';
    input!.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    const rows = element.querySelectorAll('tr.mat-mdc-row');
    expect(rows.length).toBe(1);
    expect(rows[0]?.textContent).toContain('Federated 10K');
    expect(rows[0]?.textContent).toContain('10,187');
  });
});
