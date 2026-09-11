import { TestBed } from '@angular/core/testing';
import { RouterModule } from '@angular/router';
import { StoreModule } from '@ngrx/store';
import { App } from './app';
import { mobileSearchReducer } from './state/search/search.reducer';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        RouterModule.forRoot([]),
        StoreModule.forRoot({ mobileSearch: mobileSearchReducer }),
      ],
      declarations: [App],
    }).compileComponents();
  });

  it('renders the mobile-first Census search shell', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('h1')?.textContent).toContain(
      'Find Census research',
    );
    expect(compiled.querySelector('.skip-link')?.getAttribute('href')).toBe(
      '#main-content',
    );
    expect(compiled.querySelector('form[role="search"]')).not.toBeNull();
    expect(compiled.querySelector('#research-query')).not.toBeNull();
    expect(compiled.querySelector('.status-card')?.textContent).toContain(
      'Search is ready.',
    );
  });
});
