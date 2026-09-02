import { TestBed } from '@angular/core/testing';
import { expectNoAxeViolations } from '../../testing/axe';
import { AdminBarChartComponent } from './bar-chart.component';

describe('AdminBarChartComponent', () => {
  afterEach(() => TestBed.resetTestingModule());

  async function render(
    items: readonly { label: string; value: number }[],
    caption = 'Indexed research objects by source',
  ) {
    await TestBed.configureTestingModule({
      imports: [AdminBarChartComponent],
    }).compileComponents();

    const fixture = TestBed.createComponent(AdminBarChartComponent);
    fixture.componentRef.setInput('items', items);
    fixture.componentRef.setInput('caption', caption);
    fixture.detectChanges();
    await fixture.whenStable();
    return fixture;
  }

  it('renders a semantic table equivalent for the visual bars', async () => {
    const fixture = await render([
      { label: 'Data.gov', value: 500_000 },
      { label: 'DOE OSTI', value: 250_000 },
    ]);
    const root = fixture.nativeElement as HTMLElement;
    const table = root.querySelector('table');
    const rows = [...root.querySelectorAll('tbody tr')];

    expect(table?.querySelector('caption')?.textContent?.trim()).toBe(
      'Indexed research objects by source',
    );
    expect(rows).toHaveLength(2);
    expect(rows[0]?.querySelector('th')?.textContent?.trim()).toBe('Data.gov');
    expect(rows[0]?.querySelector('td')?.textContent?.trim()).toBe('500000');
    expect(
      root.querySelector('.admin-viz-bar-chart__bars')?.getAttribute('aria-hidden'),
    ).toBe('true');

    await expectNoAxeViolations(root);
  });

  it('keeps the empty state semantic and accessible', async () => {
    const fixture = await render([], 'No indexed research objects');
    const root = fixture.nativeElement as HTMLElement;

    expect(root.querySelectorAll('tbody tr')).toHaveLength(0);
    expect(root.querySelector('caption')?.textContent?.trim()).toBe(
      'No indexed research objects',
    );

    await expectNoAxeViolations(root);
  });
});
