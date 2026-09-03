import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { HomePage } from './home-page';

describe('HomePage', () => {
  const render = async () => {
    await TestBed.configureTestingModule({
      imports: [HomePage],
      providers: [provideRouter([])],
    }).compileComponents();

    const fixture = TestBed.createComponent(HomePage);
    fixture.detectChanges();
    await fixture.whenStable();
    return fixture;
  };

  afterEach(() => TestBed.resetTestingModule());

  it('presents the current federal-scale research platform and certified corpus', async () => {
    const fixture = await render();
    const host = fixture.nativeElement as HTMLElement;

    expect(host.querySelector('h1')?.textContent).toContain(
      'Discover, connect, and map public research at federal scale',
    );
    expect(host.querySelector('.scale-card')?.textContent).toContain(
      '1,000,181 searchable records',
    );
    expect(host.querySelector('.scale-card')?.textContent).toContain(
      '500K Data.gov + 500K DOE OSTI',
    );
    expect(host.querySelectorAll('.experience-card')).toHaveLength(3);
    expect(host.querySelectorAll('.authority-flow li')).toHaveLength(4);
  });

  it('keeps the primary and operator routes discoverable from the landing page', async () => {
    const fixture = await render();
    const links = Array.from(
      fixture.nativeElement.querySelectorAll('a'),
    ) as HTMLAnchorElement[];
    const routes = links.map((link) => link.getAttribute('href'));

    expect(routes).toContain('/discovery');
    expect(routes).toContain('/maps');
    expect(routes).toContain('/evidence');
    expect(routes).toContain('/search-lab');
    expect(routes).toContain('/admin/sync');
  });
});
