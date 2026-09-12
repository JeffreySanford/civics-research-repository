import { TestBed } from '@angular/core/testing';
import { RouterModule } from '@angular/router';
import {
  RepositoryMapsApi,
  type CensusAreaBoundary,
  type PopulationEstimatesChoropleth,
  type ResearchSpatialCoverageResponse,
} from 'repository-api-client';
import { BehaviorSubject, of } from 'rxjs';
import { MobileResearchMapPreviewComponent } from './mobile-research-map-preview.component';
import { MobileResearchMapPreviewModule } from './mobile-research-map-preview.module';

const response = {
  buildId: 'mobile-map-test',
  sourceSystem: 'DATA_GOV',
  schemaVersion: 1,
  sourceSnapshotAt: '2026-09-12T12:00:00Z',
  capturedAt: '2026-09-12T12:05:00Z',
  compositionSha256: 'a'.repeat(64),
  projectionId: 'projection-mobile',
  criteriaFingerprint: 'criteria-mobile',
  viewport: { west: -180, south: -85, east: 180, north: 85 },
  summary: {
    matchingRecords: 12,
    mappedRecords: 8,
    unmappedRecords: 4,
    quarantinedRecords: 0,
    unanchoredAntimeridianRecords: 0,
    viewportMappedRecords: 8,
    returnedFeatures: 1,
    omittedFeatures: 7,
    featureLimit: 80,
    truncated: true,
  },
  features: [
    {
      sourceSystem: 'DATA_GOV',
      sourceIdentifier: 'nd-migration-map',
      title: 'North Dakota migration coverage',
      publisher: 'U.S. Census Bureau',
      program: 'ACS',
      contentType: 'DATASET',
      sourceUrl: 'https://example.test/research',
      geometryStatus: 'VALID',
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [-104.05, 45.94],
            [-96.55, 45.94],
            [-96.55, 49.0],
            [-104.05, 49.0],
            [-104.05, 45.94],
          ],
        ],
      },
      renderLon: null,
      renderLat: null,
      renderPointMethod: null,
    },
  ],
} as unknown as ResearchSpatialCoverageResponse;

const censusAreas = [
  {
    id: 'north-dakota',
    label: 'North Dakota Census area boundary preview',
    geography: 'North Dakota',
    west: -104.0489,
    south: 45.9351,
    east: -96.5545,
    north: 49.0007,
    centerLatitude: 47.5515,
    centerLongitude: -101.002,
    defaultZoom: 6,
  },
  {
    id: 'minnesota',
    label: 'Minnesota Census area boundary preview',
    geography: 'Minnesota',
    west: -97.2393,
    south: 43.4994,
    east: -89.4919,
    north: 49.3844,
    centerLatitude: 46.7296,
    centerLongitude: -94.6859,
    defaultZoom: 5.5,
  },
] as CensusAreaBoundary[];

const populationResponse = {
  source: 'U.S. Census Bureau Population Estimates Program',
  sourceUrl: 'https://example.test/co-est2025-alldata.csv',
  attribution: 'U.S. Census Bureau Population Estimates Program',
  geography: 'North Dakota',
  sourceVintage: 2025,
  sourceSha256: 'b'.repeat(64),
  capturedAt: '2026-09-05',
  geometryVintage: 2025,
  geometrySourceUrl: 'https://example.test/tigerweb/counties',
  geometryAttribution: 'U.S. Census Bureau TIGERweb',
  measure: 'ANNUAL_GROWTH_RATE',
  measureLabel: 'Annual population growth rate',
  units: 'percent',
  year: 2025,
  priorYear: 2024,
  supportedPopulationYears: [2020, 2021, 2022, 2023, 2024, 2025],
  supportedChangeYears: [2021, 2022, 2023, 2024, 2025],
  geoJson: {
    type: 'FeatureCollection',
    features: [],
  },
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

describe('MobileResearchMapPreviewComponent', () => {
  let coverageResponses: BehaviorSubject<ResearchSpatialCoverageResponse>;
  let populationRequests: string[];

  beforeEach(async () => {
    coverageResponses = new BehaviorSubject(response);
    populationRequests = [];

    await TestBed.configureTestingModule({
      imports: [RouterModule.forRoot([]), MobileResearchMapPreviewModule],
      providers: [
        {
          provide: RepositoryMapsApi,
          useValue: {
            getResearchSpatialCoverage: () => coverageResponses.asObservable(),
            listCensusAreaBoundaries: () => of(censusAreas),
            getPopulationEstimatesChoropleth: (geography: string) => {
              populationRequests.push(geography);
              return of(populationResponse);
            },
          },
        },
      ],
    }).compileComponents();
  });

  it('keeps spatial counts semantic and preserves the current query in the map link', async () => {
    const fixture = TestBed.createComponent(MobileResearchMapPreviewComponent);
    fixture.componentRef.setInput('query', {
      q: 'North Dakota migration',
      publisher: 'U.S. Census Bureau',
    });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain(
      '8 of 12 matching Data.gov spatial records',
    );
    expect(compiled.textContent).toContain(
      '4 matching records do not declare publisher geometry',
    );
    expect(compiled.textContent).toContain('Showing 1 of 8');

    const link = compiled.querySelector(
      'a[aria-label="Open research coverage map for the current search"]',
    );
    expect(link).not.toBeNull();
    expect(compiled.querySelector('#mobile-map-preset')).toBeNull();
  });

  it('matches a search geography to Census area context without changing search semantics', async () => {
    const fixture = TestBed.createComponent(MobileResearchMapPreviewComponent);
    fixture.componentRef.setInput('expanded', true);
    fixture.componentRef.setInput('interactive', true);
    fixture.componentRef.setInput('query', {
      q: 'migration',
      geography: 'North Dakota',
    });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const preset = compiled.querySelector(
      '#mobile-map-preset',
    ) as HTMLSelectElement | null;
    const area = compiled.querySelector(
      '#mobile-census-area',
    ) as HTMLSelectElement | null;

    expect(preset?.value).toBe('research-area-context');
    expect(area?.value).toBe('north-dakota');
    expect(compiled.textContent).toContain('North Dakota area context');
    expect(compiled.textContent).toContain(
      'It is not exact TIGER/Line administrative geometry',
    );
  });

  it('loads semantic Population Estimates context without changing repository query intent', async () => {
    const fixture = TestBed.createComponent(MobileResearchMapPreviewComponent);
    fixture.componentRef.setInput('expanded', true);
    fixture.componentRef.setInput('interactive', true);
    fixture.componentRef.setInput('query', {
      q: 'migration',
      publisher: 'U.S. Census Bureau',
    });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const preset = compiled.querySelector(
      '#mobile-map-preset',
    ) as HTMLSelectElement;
    preset.value = 'community-population';
    preset.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    const area = compiled.querySelector(
      '#mobile-census-area',
    ) as HTMLSelectElement;
    area.value = 'north-dakota';
    area.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const population = compiled.querySelector(
      '[data-testid="mobile-population-context"]',
    );
    expect(populationRequests).toEqual(['North Dakota']);
    expect(preset.value).toBe('community-population');
    expect(area.value).toBe('north-dakota');
    expect(population?.textContent).toContain(
      'Annual population growth rate for North Dakota, 2024–2025',
    );
    expect(population?.textContent).toContain('Adams County');
    expect(population?.textContent).toContain('-2.5%');
    expect(population?.textContent).toContain('Cass County');
    expect(population?.textContent).toContain('+3.25%');
    expect(population?.textContent).toContain('2025 population 202,000');
    expect(population?.textContent).toContain('Vintage 2025');
  });

  it('uses one selected research state for the semantic list and detail panel', async () => {
    const fixture = TestBed.createComponent(MobileResearchMapPreviewComponent);
    fixture.componentRef.setInput('expanded', true);
    fixture.componentRef.setInput('interactive', true);
    fixture.componentRef.setInput('query', { q: 'migration' });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const preview = compiled.querySelector(
      '[data-testid="mobile-research-map-preview"]',
    );
    const selectButton = compiled.querySelector(
      'button[aria-label="Show on map: North Dakota migration coverage"]',
    ) as HTMLButtonElement | null;

    expect(preview).not.toBeNull();
    expect(selectButton).not.toBeNull();
    expect(selectButton?.getAttribute('aria-pressed')).toBe('false');
    selectButton?.click();
    fixture.detectChanges();

    const selectedPanel = compiled.querySelector(
      '[data-testid="mobile-selected-research"]',
    );
    const selectedButton = compiled.querySelector(
      'button[aria-label="Selected on map: North Dakota migration coverage"]',
    );

    expect(preview?.getAttribute('data-selected-source')).toBe(
      'nd-migration-map',
    );
    expect(selectedButton?.getAttribute('aria-pressed')).toBe('true');
    expect(selectedPanel?.textContent).toContain(
      'North Dakota migration coverage',
    );
    expect(selectedPanel?.textContent).toContain('U.S. Census Bureau');
    expect(selectedPanel?.textContent).toContain('ACS');
    expect(
      selectedPanel?.querySelector('a[href="https://example.test/research"]'),
    ).not.toBeNull();
  });

  it('clears selected research when a bounded refresh no longer returns it', async () => {
    const fixture = TestBed.createComponent(MobileResearchMapPreviewComponent);
    fixture.componentRef.setInput('expanded', true);
    fixture.componentRef.setInput('interactive', true);
    fixture.componentRef.setInput('query', { q: 'migration' });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const preview = compiled.querySelector(
      '[data-testid="mobile-research-map-preview"]',
    );
    const selectButton = compiled.querySelector(
      'button[aria-label="Show on map: North Dakota migration coverage"]',
    ) as HTMLButtonElement | null;
    selectButton?.click();
    fixture.detectChanges();
    expect(preview?.getAttribute('data-selected-source')).toBe(
      'nd-migration-map',
    );

    coverageResponses.next({
      ...response,
      summary: {
        ...response.summary,
        viewportMappedRecords: 0,
        returnedFeatures: 0,
        omittedFeatures: 0,
        truncated: false,
      },
      features: [],
    });
    fixture.detectChanges();

    expect(preview?.getAttribute('data-selected-source')).toBeNull();
    expect(
      compiled.querySelector('[data-testid="mobile-selected-research"]')
        ?.textContent,
    ).toContain('Select a mapped research record');
  });
});
