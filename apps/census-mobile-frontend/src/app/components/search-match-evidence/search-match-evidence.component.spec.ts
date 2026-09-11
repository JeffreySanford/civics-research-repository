import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SearchMatchEvidenceComponent } from './search-match-evidence.component';

describe('SearchMatchEvidenceComponent', () => {
  let fixture: ComponentFixture<SearchMatchEvidenceComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [SearchMatchEvidenceComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(SearchMatchEvidenceComponent);
  });

  it('renders engine-provided fields and terms without claiming score contribution', () => {
    fixture.componentRef.setInput('evidence', [
      { field: 'TITLE', label: 'Title', matchedTerms: ['migration'] },
      {
        field: 'GEOGRAPHY',
        label: 'Geography',
        matchedTerms: ['North Dakota'],
      },
    ]);
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('summary')?.textContent).toContain(
      'Why this matched',
    );
    expect(element.textContent).toContain('Title');
    expect(element.textContent).toContain('migration');
    expect(element.textContent).toContain('North Dakota');
    expect(element.textContent).toContain(
      'do not represent exact score contribution',
    );
  });

  it('renders nothing when the API supplies no match evidence', () => {
    fixture.detectChanges();
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('details'),
    ).toBeNull();
  });
});
