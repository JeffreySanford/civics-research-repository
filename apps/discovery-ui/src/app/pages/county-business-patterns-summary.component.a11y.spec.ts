import { TestBed } from '@angular/core/testing';
import type { CountyBusinessPatternsChoropleth } from 'repository-api-client';
import { expectNoAxeViolations } from '../testing/axe';
import { CountyBusinessPatternsSummaryComponent } from './county-business-patterns-summary.component';

const choropleth = {
  layerId: 'county-business-patterns-north-dakota',
  source: 'U.S. Census Bureau County Business Patterns',
  sourceUrl: 'https://example.test/cbp23co.zip',
  attribution: 'U.S. Census Bureau County Business Patterns',
  geography: 'North Dakota',
  geographyLevel: 'COUNTY',
  sourceReferenceYear: 2023,
  sourceSha256: 'a'.repeat(64),
  capturedAt: '2026-09-06',
  geometryVintage: 2023,
  geometrySourceUrl: 'https://example.test/counties',
  geometryAttribution: 'U.S. Census Bureau TIGERweb',
  measure: 'EMPLOYMENT',
  measureLabel: 'Mid-March employment',
  units: 'people',
  industryCode: '31',
  industryLabel: '31-33 Manufacturing',
  year: 2023,
  availableCountyCount: 1,
  unavailableCountyCount: 1,
  excludedStatewideRows: 753,
  missingRowSemantics:
    'A missing county/industry row is unavailable in the published source and must not be interpreted as zero.',
  geoJson: { type: 'FeatureCollection', features: [] },
  counties: [
    {
      fips: '38017',
      name: 'Cass County',
      available: true,
      value: 8_200,
      noiseFlag: 'G',
    },
    {
      fips: '38095',
      name: 'Towner County',
      available: false,
      value: null,
      noiseFlag: null,
    },
  ],
} as CountyBusinessPatternsChoropleth;

describe('CountyBusinessPatternsSummaryComponent accessibility', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CountyBusinessPatternsSummaryComponent],
    }).compileComponents();
  });

  it('has no axe violations for published and unavailable county values', async () => {
    const fixture = TestBed.createComponent(
      CountyBusinessPatternsSummaryComponent,
    );
    fixture.componentRef.setInput('choropleth', choropleth);
    fixture.detectChanges();

    await expectNoAxeViolations(fixture.nativeElement);
  });

  it('has no axe violations while CBP values are loading', async () => {
    const fixture = TestBed.createComponent(
      CountyBusinessPatternsSummaryComponent,
    );
    fixture.componentRef.setInput('loading', true);
    fixture.detectChanges();

    await expectNoAxeViolations(fixture.nativeElement);
  });

  it('has no axe violations for the unavailable service state', async () => {
    const fixture = TestBed.createComponent(
      CountyBusinessPatternsSummaryComponent,
    );
    fixture.componentRef.setInput(
      'error',
      'County geometry service unavailable.',
    );
    fixture.detectChanges();

    await expectNoAxeViolations(fixture.nativeElement);
  });
});
