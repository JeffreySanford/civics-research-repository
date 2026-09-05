import { TestBed } from '@angular/core/testing';
import { expectNoAxeViolations } from '../testing/axe';
import { TerrainLayerStatusComponent } from './terrain-layer-status.component';

describe('TerrainLayerStatusComponent accessibility', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TerrainLayerStatusComponent],
    }).compileComponents();
  });

  it('has no axe violations for ready terrain', async () => {
    const fixture = TestBed.createComponent(TerrainLayerStatusComponent);

    fixture.componentRef.setInput('visible', true);
    fixture.componentRef.setInput('mode', 'hillshade');
    fixture.componentRef.setInput('status', 'ready');
    fixture.componentRef.setInput(
      'sourceUrl',
      'https://elevation.nationalmap.gov/arcgis/rest/services/3DEPElevation/ImageServer',
    );
    fixture.detectChanges();

    await expectNoAxeViolations(fixture.nativeElement);
  });

  it('has no axe violations while terrain is loading', async () => {
    const fixture = TestBed.createComponent(TerrainLayerStatusComponent);

    fixture.componentRef.setInput('visible', true);
    fixture.componentRef.setInput('status', 'loading');
    fixture.detectChanges();

    await expectNoAxeViolations(fixture.nativeElement);
  });

  it('has no axe violations for error and unsupported states', async () => {
    const errorFixture = TestBed.createComponent(TerrainLayerStatusComponent);
    errorFixture.componentRef.setInput('visible', true);
    errorFixture.componentRef.setInput('status', 'error');
    errorFixture.detectChanges();
    await expectNoAxeViolations(errorFixture.nativeElement);

    const unsupportedFixture = TestBed.createComponent(
      TerrainLayerStatusComponent,
    );
    unsupportedFixture.componentRef.setInput('available', false);
    unsupportedFixture.detectChanges();
    await expectNoAxeViolations(unsupportedFixture.nativeElement);
  });
});
