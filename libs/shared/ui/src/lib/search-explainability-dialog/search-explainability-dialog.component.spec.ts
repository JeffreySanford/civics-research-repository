import { TestBed } from '@angular/core/testing';
import { SearchExplainabilityDialogComponent } from './search-explainability-dialog.component';

describe('SearchExplainabilityDialogComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SearchExplainabilityDialogComponent],
    }).compileComponents();
  });

  it('renders server-owned ranking evidence with calibration caveats', () => {
    const fixture = TestBed.createComponent(SearchExplainabilityDialogComponent);
    const component = fixture.componentInstance;
    component.resultTitle = 'North Dakota migration example';
    component.query = 'North Dakota migration';
    component.rank = 2;
    component.relevance = { band: 'STRONG', normalizedScore: 0.91 };
    component.relevanceModel = {
      engine: 'SOLR',
      normalization: 'SOLR_MAX_SCORE_RATIO_V1',
      calibrated: false,
    };
    component.matchEvidence = [
      { label: 'Title', matchedTerms: ['migration'] },
      { label: 'Geography', matchedTerms: ['North Dakota'] },
    ];
    component.activeFilters = [{ label: 'Dataset' }];
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Rank 2');
    expect(compiled.textContent).toContain('Strong');
    expect(compiled.textContent).toContain('0.91');
    expect(compiled.textContent).toContain('not confidence or a probability');
    expect(compiled.textContent).toContain('not calibrated');
    expect(compiled.textContent).toContain('Title');
    expect(compiled.textContent).toContain('migration');
    expect(compiled.textContent).toContain('North Dakota');
    expect(compiled.textContent).toContain('Dataset');
  });

  it('uses a result-specific accessible name on the entry control', () => {
    const fixture = TestBed.createComponent(SearchExplainabilityDialogComponent);
    fixture.componentInstance.resultTitle = 'County migration estimates';
    fixture.componentInstance.query = 'migration';
    fixture.detectChanges();

    const trigger = fixture.nativeElement.querySelector(
      '.explainability-trigger',
    ) as HTMLButtonElement | null;
    expect(trigger?.getAttribute('aria-label')).toBe(
      'Why this result matched: County migration estimates',
    );
  });

  it('keeps missing field evidence explicit', () => {
    const fixture = TestBed.createComponent(SearchExplainabilityDialogComponent);
    fixture.componentInstance.resultTitle = 'Research object';
    fixture.componentInstance.query = 'workforce';
    fixture.componentInstance.rank = 4;
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'No field-level match evidence was returned for this result.',
    );
  });
});
