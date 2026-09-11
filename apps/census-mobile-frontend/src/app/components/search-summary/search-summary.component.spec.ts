import { TestBed } from '@angular/core/testing';
import type { FacetGroup } from 'repository-api-client';
import { SearchSummaryComponent } from './search-summary.component';

const typeFacet: FacetGroup = {
  field: 'type',
  label: 'Type',
  values: [
    { value: 'DATASET', label: 'DATASET', count: 60, selected: false },
    { value: 'PUBLICATION', label: 'PUBLICATION', count: 25, selected: false },
    { value: 'METHODOLOGY', label: 'METHODOLOGY', count: 10, selected: false },
    { value: 'CODE', label: 'CODE', count: 4, selected: false },
    { value: 'PROJECT', label: 'PROJECT', count: 1, selected: false },
  ],
};

describe('SearchSummaryComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [SearchSummaryComponent],
    }).compileComponents();
  });

  it('renders exact query-wide counts and derived percentages', () => {
    const fixture = TestBed.createComponent(SearchSummaryComponent);
    fixture.componentRef.setInput('facet', typeFacet);
    fixture.componentRef.setInput('totalResults', 100);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('60 · 60%');
    expect(compiled.textContent).toContain('25 · 25%');
    expect(compiled.textContent).toContain('not only the visible page');
  });

  it('uses a Signal-backed disclosure for long type lists', () => {
    const fixture = TestBed.createComponent(SearchSummaryComponent);
    fixture.componentRef.setInput('facet', typeFacet);
    fixture.componentRef.setInput('totalResults', 100);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const button = compiled.querySelector<HTMLButtonElement>(
      '.search-summary__toggle',
    );
    expect(compiled.querySelectorAll('.search-summary__value')).toHaveLength(4);
    expect(button?.getAttribute('aria-expanded')).toBe('false');

    button?.click();
    fixture.detectChanges();

    expect(compiled.querySelectorAll('.search-summary__value')).toHaveLength(5);
    expect(button?.getAttribute('aria-expanded')).toBe('true');
    expect(button?.textContent).toContain('Show fewer types');
  });

  it('does not render when there is no facet evidence', () => {
    const fixture = TestBed.createComponent(SearchSummaryComponent);
    fixture.componentRef.setInput('facet', null);
    fixture.componentRef.setInput('totalResults', 100);
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent?.trim()).toBe('');
  });
});
