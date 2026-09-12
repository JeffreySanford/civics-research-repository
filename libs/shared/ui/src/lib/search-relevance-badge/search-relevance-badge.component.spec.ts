import { TestBed } from '@angular/core/testing';
import type { SearchRelevance } from 'repository-api-client';
import { SearchRelevanceBadgeComponent } from './search-relevance-badge.component';

const relevance = (
  band: SearchRelevance['band'],
  normalizedScore: number,
): SearchRelevance => ({
  rawScore: normalizedScore * 10,
  normalizedScore,
  band,
});

describe('SearchRelevanceBadgeComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SearchRelevanceBadgeComponent],
    }).compileComponents();
  });

  it.each([
    ['STRONG', 'Strong match'],
    ['GOOD', 'Good match'],
    ['MODERATE', 'Moderate match'],
    ['WEAK', 'Weak match'],
    ['LOW', 'Low match'],
  ] as const)('renders %s as visible and accessible text', (band, label) => {
    const fixture = TestBed.createComponent(SearchRelevanceBadgeComponent);
    fixture.componentInstance.relevance = relevance(band, 0.5);
    fixture.detectChanges();

    const badge = fixture.nativeElement.querySelector(
      '.relevance-badge',
    ) as HTMLElement | null;

    expect(badge?.textContent).toContain(label);
    expect(badge?.getAttribute('aria-label')).toContain(label);
    expect(badge?.getAttribute('aria-label')).toContain(
      'Query-relative search match strength',
    );
  });

  it('renders nothing when score evidence is unavailable', () => {
    const fixture = TestBed.createComponent(SearchRelevanceBadgeComponent);
    fixture.componentInstance.relevance = null;
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.relevance-badge')).toBeNull();
  });
});
