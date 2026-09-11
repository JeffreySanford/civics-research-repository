import { A11yModule } from '@angular/cdk/a11y';
import { TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { provideRouter } from '@angular/router';
import { provideMockStore } from '@ngrx/store/testing';
import { initialSearchState } from '../../state/search/search.reducer';
import { SearchPageComponent } from './search-page.component';

describe('SearchPageComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [A11yModule, ReactiveFormsModule],
      declarations: [SearchPageComponent],
      providers: [
        provideRouter([]),
        provideMockStore({ initialState: { search: initialSearchState } }),
      ],
    }).compileComponents();
  });

  it('renders the search landmark and opens the accessible filter drawer', () => {
    const fixture = TestBed.createComponent(SearchPageComponent);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelector('form[role="search"]')).not.toBeNull();

    const filterButton = element.querySelector<HTMLButtonElement>('.filter-trigger');
    filterButton?.click();
    fixture.detectChanges();

    const drawer = element.querySelector<HTMLElement>('[role="dialog"]');
    expect(drawer).not.toBeNull();
    expect(drawer?.getAttribute('aria-modal')).toBe('true');
  });
});
