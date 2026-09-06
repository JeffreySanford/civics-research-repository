import type { MapLayer } from 'repository-api-client';
import { MapsActions } from './maps.actions';
import { initialMapsState, mapsReducer } from './maps.reducer';

const cbpLayer = {
  id: 'county-business-patterns-north-dakota',
  label: '2023 County Business Patterns - North Dakota',
  layerType: 'CENSUS_CHOROPLETH',
  sourceUrl: 'https://example.test/cbp23co.zip',
  attribution: 'U.S. Census Bureau County Business Patterns',
  visibleByDefault: false,
} as unknown as MapLayer;

describe('County Business Patterns maps reducer', () => {
  it('defaults to total establishments in 2023 and keeps the layer hidden', () => {
    expect(initialMapsState.countyBusinessPatternsVisible).toBe(false);
    expect(initialMapsState.countyBusinessPatternsMeasure).toBe('ESTABLISHMENTS');
    expect(initialMapsState.countyBusinessPatternsIndustry).toBe('TOTAL');
    expect(initialMapsState.countyBusinessPatternsYear).toBe(2023);
  });

  it('clears stale data while a new CBP configuration is requested', () => {
    const populated = {
      ...initialMapsState,
      countyBusinessPatternsChoropleth: { geography: 'North Dakota' } as never,
      countyBusinessPatternsError: 'old error',
    };

    const state = mapsReducer(
      populated,
      MapsActions.countyBusinessPatternsConfigurationChanged({
        measure: 'EMPLOYMENT',
        industry: '62',
        year: 2023,
      }),
    );

    expect(state.countyBusinessPatternsMeasure).toBe('EMPLOYMENT');
    expect(state.countyBusinessPatternsIndustry).toBe('62');
    expect(state.countyBusinessPatternsYear).toBe(2023);
    expect(state.countyBusinessPatternsChoropleth).toBeNull();
    expect(state.countyBusinessPatternsError).toBeNull();
  });

  it('resets CBP visibility and data when the selected area does not advertise the capability', () => {
    const populated = {
      ...initialMapsState,
      countyBusinessPatternsVisible: true,
      countyBusinessPatternsLoading: true,
      countyBusinessPatternsChoropleth: { geography: 'North Dakota' } as never,
      countyBusinessPatternsError: 'stale',
    };

    const state = mapsReducer(
      populated,
      MapsActions.mapLayersLoaded({ layers: [] }),
    );

    expect(state.countyBusinessPatternsVisible).toBe(false);
    expect(state.countyBusinessPatternsLoading).toBe(false);
    expect(state.countyBusinessPatternsChoropleth).toBeNull();
    expect(state.countyBusinessPatternsError).toBeNull();
  });

  it('preserves CBP state when the capability remains available', () => {
    const choropleth = { geography: 'North Dakota' } as never;
    const populated = {
      ...initialMapsState,
      countyBusinessPatternsVisible: true,
      countyBusinessPatternsChoropleth: choropleth,
    };

    const state = mapsReducer(
      populated,
      MapsActions.mapLayersLoaded({ layers: [cbpLayer] }),
    );

    expect(state.countyBusinessPatternsVisible).toBe(true);
    expect(state.countyBusinessPatternsChoropleth).toBe(choropleth);
  });
});
