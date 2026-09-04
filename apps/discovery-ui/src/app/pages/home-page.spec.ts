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

  it('presents the frontend mission with scale as supporting validation', async () => {
    const fixture = await render();
    const host = fixture.nativeElement as HTMLElement;

    expect(host.querySelector('h1')?.textContent).toContain(
      'Discover, connect, and map public research at federal scale',
    );

    const intro = host.querySelector('.landing-hero__intro')?.textContent ?? '';
    expect(intro).toContain('Angular 22 + NgRx/RxJS');
    expect(intro).toContain('generated API contract');

    const signals = Array.from(
      host.querySelectorAll('.landing-hero__signals li'),
    ).map((signal) => signal.textContent?.trim());
    expect(signals).toContain('Angular 22 + NgRx');
    expect(signals).toContain('Generated OpenAPI');
    expect(signals).toContain('Accessible MapLibre');
    expect(signals).toContain('WCAG / Section 508 evidence');

    const scaleCard = host.querySelector('.scale-card')?.textContent ?? '';
    expect(scaleCard).toContain('Scale validation');
    expect(scaleCard).toContain('1,000,181 searchable records');
    expect(scaleCard).toContain('500K Data.gov + 500K DOE OSTI');

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
