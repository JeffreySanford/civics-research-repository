import { TestBed } from '@angular/core/testing';
import { RouterModule } from '@angular/router';
import { App } from './app';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RouterModule.forRoot([])],
      declarations: [App],
    }).compileComponents();
  });

  it('renders the mobile-first Census application shell', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('.masthead__title')?.textContent).toContain(
      'Census Research',
    );
    expect(compiled.querySelector('.skip-link')?.getAttribute('href')).toBe(
      '#main-content',
    );
    expect(compiled.querySelector('router-outlet')).not.toBeNull();
  });
});
