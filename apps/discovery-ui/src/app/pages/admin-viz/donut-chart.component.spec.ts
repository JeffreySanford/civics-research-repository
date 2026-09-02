import { TestBed } from '@angular/core/testing';
import { expectNoAxeViolations } from '../../testing/axe';
import { AdminDonutChartComponent } from './donut-chart.component';

describe('AdminDonutChartComponent', () => {
  afterEach(() => TestBed.resetTestingModule());

  async function render(
    segments: readonly { label: string; value: number; color: string }[],
    caption = 'Indexed research objects by source',
  ) {
    await TestBed.configureTestingModule({
      imports: [AdminDonutChartComponent],
    }).compileComponents();

    const fixture = TestBed.createComponent(AdminDonutChartComponent);
    fixture.componentRef.setInput('segments', segments);
    fixture.componentRef.setInput('caption', caption);
    fixture.detectChanges();
    await fixture.whenStable();
    return fixture;
  }

  it('renders an accessible image name and semantic table equivalent', async () => {
    const fixture = await render([
      { label: 'Data.gov', value: 500_000, color: '#315da8' },
      { label: 'DOE OSTI', value: 500_000, color: '#8a4f12' },
      { label: 'Curated DSpace', value: 181, color: '#5b5f63' },
    ]);
    const root = fixture.nativeElement as HTMLElement;
    const svg = root.querySelector('svg');
    const rows = [...root.querySelectorAll('tbody tr')];

    expect(svg?.getAttribute('role')).toBe('img');
    expect(svg?.getAttribute('aria-label')).toBe(
      'Indexed research objects by source',
    );
    expect(root.querySelector('caption')?.textContent?.trim()).toBe(
      'Indexed research objects by source',
    );
    expect(rows).toHaveLength(3);
    expect(rows[2]?.querySelector('th')?.textContent?.trim()).toBe(
      'Curated DSpace',
    );
    expect(rows[2]?.querySelector('td')?.textContent?.trim()).toBe('181');
    expect(
      root
        .querySelector('.admin-viz-donut__legend')
        ?.getAttribute('aria-hidden'),
    ).toBe('true');

    await expectNoAxeViolations(root);
  });

  it('keeps a zero-total empty state semantic and accessible', async () => {
    const fixture = await render([], 'No indexed research objects');
    const root = fixture.nativeElement as HTMLElement;

    expect(root.querySelectorAll('tbody tr')).toHaveLength(0);
    expect(root.querySelector('svg')?.getAttribute('aria-label')).toBe(
      'No indexed research objects',
    );
    expect(
      root.querySelector('.admin-viz-donut__total')?.textContent?.trim(),
    ).toBe('0');

    await expectNoAxeViolations(root);
  });
});
