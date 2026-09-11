import { TestBed } from '@angular/core/testing';
import { SearchRankBadgeComponent } from './search-rank-badge.component';

describe('SearchRankBadgeComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SearchRankBadgeComponent],
    }).compileComponents();
  });

  it('labels the first three results as top ranked', () => {
    const fixture = TestBed.createComponent(SearchRankBadgeComponent);
    fixture.componentInstance.rank = 2;
    fixture.detectChanges();

    const badge = fixture.nativeElement.querySelector(
      '.rank-badge',
    ) as HTMLElement | null;

    expect(badge?.textContent).toContain('Top ranked');
    expect(badge?.textContent).toContain('Rank 2');
    expect(badge?.getAttribute('aria-label')).toBe(
      'Top ranked. Rank 2 in this search.',
    );
  });

  it('renders an ordinary rank after the top three', () => {
    const fixture = TestBed.createComponent(SearchRankBadgeComponent);
    fixture.componentInstance.rank = 7;
    fixture.detectChanges();

    const badge = fixture.nativeElement.querySelector(
      '.rank-badge',
    ) as HTMLElement | null;

    expect(badge?.textContent).not.toContain('Top ranked');
    expect(badge?.textContent).toContain('Rank 7');
    expect(badge?.getAttribute('aria-label')).toBe('Rank 7 in this search.');
  });

  it('renders nothing for a non-result rank', () => {
    const fixture = TestBed.createComponent(SearchRankBadgeComponent);
    fixture.componentInstance.rank = 0;
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.rank-badge')).toBeNull();
  });
});
