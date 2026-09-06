import { TestBed } from '@angular/core/testing';
import { provideMockActions } from '@ngrx/effects/testing';
import { provideMockStore } from '@ngrx/store/testing';
import { lastValueFrom, of, toArray, type Observable } from 'rxjs';
import { RepositoryMapsApi, type MapLayer } from 'repository-api-client';
import { MapsActions } from './maps.actions';
import { MapsEffects } from './maps.effects';
import {
  selectCountyBusinessPatternsIndustry,
  selectCountyBusinessPatternsMeasure,
  selectCountyBusinessPatternsYear,
  selectMapLayers,
  selectPopulationEstimateMeasure,
  selectPopulationEstimateYear,
  selectSelectedGeography,
} from './maps.selectors';

const baseLayer = {
  id: 'tiger-boundary',
  label: 'North Dakota TIGER/Line preview',
  layerType: 'CENSUS_BOUNDARY',
  sourceUrl: 'https://example.test/tiger',
  attribution: 'U.S. Census Bureau TIGER/Line',
  visibleByDefault: true,
} as unknown as MapLayer;

const cbpLayer = {
  id: 'county-business-patterns-north-dakota',
  label: '2023 County Business Patterns - North Dakota',
  layerType: 'CENSUS_CHOROPLETH',
  sourceUrl: 'https://example.test/cbp23co.zip',
  attribution: 'U.S. Census Bureau County Business Patterns',
  visibleByDefault: false,
} as unknown as MapLayer;

function setup(
  mapsApi: Partial<RepositoryMapsApi>,
  actions$: Observable<unknown>,
  selectedLayers: MapLayer[] = [baseLayer, cbpLayer],
) {
  TestBed.configureTestingModule({
    providers: [
      MapsEffects,
      provideMockActions(() => actions$),
      provideMockStore({
        selectors: [
          { selector: selectSelectedGeography, value: 'North Dakota' },
          { selector: selectMapLayers, value: selectedLayers },
          {
            selector: selectPopulationEstimateMeasure,
            value: 'ANNUAL_GROWTH_RATE',
          },
          { selector: selectPopulationEstimateYear, value: 2025 },
          {
            selector: selectCountyBusinessPatternsMeasure,
            value: 'ESTABLISHMENTS',
          },
          { selector: selectCountyBusinessPatternsIndustry, value: 'TOTAL' },
          { selector: selectCountyBusinessPatternsYear, value: 2023 },
        ],
      }),
      { provide: RepositoryMapsApi, useValue: mapsApi },
    ],
  });

  return TestBed.inject(MapsEffects);
}

describe('County Business Patterns map effects', () => {
  it('loads the current CBP configuration when the capability is advertised', async () => {
    const countyBusinessPatternsChoropleth = {
      geography: 'North Dakota',
      measure: 'ESTABLISHMENTS',
      industryCode: 'TOTAL',
      year: 2023,
    } as never;
    const getCountyBusinessPatternsChoropleth = vi
      .fn()
      .mockReturnValue(of(countyBusinessPatternsChoropleth));
    const effects = setup(
      { getCountyBusinessPatternsChoropleth } as unknown as RepositoryMapsApi,
      of(MapsActions.mapLayersLoaded({ layers: [baseLayer, cbpLayer] })),
    );

    const emitted = await lastValueFrom(
      effects.loadCountyBusinessPatternsForSelectedArea$.pipe(toArray()),
    );

    expect(getCountyBusinessPatternsChoropleth).toHaveBeenCalledWith(
      'North Dakota',
      'ESTABLISHMENTS',
      'TOTAL',
      2023,
    );
    expect(emitted).toEqual([
      MapsActions.countyBusinessPatternsRequested(),
      MapsActions.countyBusinessPatternsLoaded({
        countyBusinessPatternsChoropleth,
      }),
    ]);
  });

  it('does not request CBP when the selected area does not advertise it', async () => {
    const getCountyBusinessPatternsChoropleth = vi.fn();
    const effects = setup(
      { getCountyBusinessPatternsChoropleth } as unknown as RepositoryMapsApi,
      of(MapsActions.mapLayersLoaded({ layers: [baseLayer] })),
      [baseLayer],
    );

    const emitted = await lastValueFrom(
      effects.loadCountyBusinessPatternsForSelectedArea$.pipe(toArray()),
    );

    expect(emitted).toEqual([]);
    expect(getCountyBusinessPatternsChoropleth).not.toHaveBeenCalled();
  });

  it('reloads CBP with the exact measure, industry, and year chosen by the user', async () => {
    const countyBusinessPatternsChoropleth = {
      geography: 'North Dakota',
      measure: 'ANNUAL_PAYROLL',
      industryCode: '31',
      industryLabel: '31-33 Manufacturing',
      year: 2023,
    } as never;
    const getCountyBusinessPatternsChoropleth = vi
      .fn()
      .mockReturnValue(of(countyBusinessPatternsChoropleth));
    const effects = setup(
      { getCountyBusinessPatternsChoropleth } as unknown as RepositoryMapsApi,
      of(
        MapsActions.countyBusinessPatternsConfigurationChanged({
          measure: 'ANNUAL_PAYROLL',
          industry: '31',
          year: 2023,
        }),
      ),
    );

    const emitted = await lastValueFrom(
      effects.reloadCountyBusinessPatternsForConfiguration$.pipe(toArray()),
    );

    expect(getCountyBusinessPatternsChoropleth).toHaveBeenCalledWith(
      'North Dakota',
      'ANNUAL_PAYROLL',
      '31',
      2023,
    );
    expect(emitted).toEqual([
      MapsActions.countyBusinessPatternsRequested(),
      MapsActions.countyBusinessPatternsLoaded({
        countyBusinessPatternsChoropleth,
      }),
    ]);
  });
});
