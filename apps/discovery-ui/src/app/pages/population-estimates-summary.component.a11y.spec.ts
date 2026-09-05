import { TestBed } from '@angular/core/testing';
import type { PopulationEstimatesChoropleth } from 'repository-api-client';
import { expectNoAxeViolations } from '../testing/axe';
import { PopulationEstimatesSummaryComponent } from './population-estimates-summary.component';

const growth = {
  source: 'U.S. Census Bureau Population Estimates Program',
  sourceUrl: 'https://example.test/population.csv',
  attribution: 'U.S. Census Bureau Population Estimates Program',
  geography: 'North Dakota',
  sourceVintage: 2025,
  sourceSha256: 'a'.repeat(64),
  capturedAt: '2026-09-05',
  geometryVintage: 2025,
  geometrySourceUrl: 'https://example.test/counties',
  geometryAttribution: 'U.S. Census Bureau TIGERweb',
  measure: 'ANNUAL_GROWTH_RATE',
  measureLabel: 'Annual population growth rate',
  units: 'percent',
  year: 2025,
  priorYear: 2024,
  supportedPopulationYears: [2020, 2021, 2022, 2023, 2024, 2025],
  supportedChangeYears: [2021, 2022, 2023, 2024, 2025],
  geoJson: { type: 'FeatureCollection', features: [] },
  counties: [
    {
      fips: '38001',
      name: 'Adams County',
      value: -2.5,
      population: 2_100,
      priorPopulation: 2_154,
    },
    {
      fips: '38017',
      name: 'Cass County',
      value: 3.25,
      population: 202_000,
      priorPopulation: 195_640,
    },
  ],
} as PopulationEstimatesChoropleth;

describe('PopulationEstimatesSummaryComponent accessibility', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PopulationEstimatesSummaryComponent],
    }).compileComponents();
  });

  it('has no axe violations for positive and negative growth', async () => {
    const fixture = TestBed.createComponent(
      PopulationEstimatesSummaryComponent,
    );

    fixture.componentRef.setInput('choropleth', growth);
    fixture.detectChanges();

    await expectNoAxeViolations(fixture.nativeElement);
  });

  it('has no axe violations while population values are loading', async () => {
    const fixture = TestBed.createComponent(
      PopulationEstimatesSummaryComponent,
    );

    fixture.componentRef.setInput('loading', true);
    fixture.detectChanges();

    await expectNoAxeViolations(fixture.nativeElement);
  });

  it('has no axe violations for the unavailable state', async () => {
    const fixture = TestBed.createComponent(
      PopulationEstimatesSummaryComponent,
    );

    fixture.componentRef.setInput(
      'error',
      'County geometry service unavailable.',
    );
    fixture.detectChanges();

    await expectNoAxeViolations(fixture.nativeElement);
  });
});
