import type { MapLayer } from 'repository-api-client';
import { MapsActions } from './maps.actions';
import { initialMapsState, mapsReducer } from './maps.reducer';
import {
  selectHydrographyLayer,
  selectTerrainAvailable,
  selectTerrainLayer,
} from './maps.selectors';

const terrainLayer = {
  id: 'usgs-3dep-terrain',
  label: 'USGS 3DEP terrain',
  layerType: 'USGS_REFERENCE',
  sourceUrl:
    'https://elevation.nationalmap.gov/arcgis/rest/services/3DEPElevation/ImageServer',
  attribution: 'U.S. Geological Survey 3D Elevation Program',
  visibleByDefault: false,
  rasterTileUrlTemplate:
    '/overlays/usgs/terrain/export?bbox={bbox-epsg-3857}&mode=hillshade',
} as MapLayer;

const hydrographyLayer = {
  id: 'usgs-3hp-hydrography',
  label: 'USGS 3D Hydrography Program reference',
  layerType: 'USGS_REFERENCE',
  sourceUrl:
    'https://hydro.nationalmap.gov/arcgis/rest/services/3DHP_all/MapServer',
  attribution: 'U.S. Geological Survey 3D Hydrography Program',
  visibleByDefault: false,
} as MapLayer;

describe('USGS terrain NgRx state', () => {
  it('starts hidden in Hillshade mode', () => {
    expect(initialMapsState.terrainVisible).toBe(false);
    expect(initialMapsState.terrainMode).toBe('hillshade');
  });

  it('tracks visibility and visualization mode independently', () => {
    const visible = mapsReducer(
      initialMapsState,
      MapsActions.terrainLayerToggled({ visible: true }),
    );
    const slope = mapsReducer(
      visible,
      MapsActions.terrainModeChanged({ mode: 'slope' }),
    );

    expect(slope.terrainVisible).toBe(true);
    expect(slope.terrainMode).toBe('slope');
  });

  it('preserves terrain visibility only while the capability is advertised', () => {
    const requested = {
      ...initialMapsState,
      terrainVisible: true,
      terrainMode: 'tinted' as const,
    };

    const supported = mapsReducer(
      requested,
      MapsActions.mapLayersLoaded({ layers: [terrainLayer] }),
    );
    const unsupported = mapsReducer(
      supported,
      MapsActions.mapLayersLoaded({ layers: [hydrographyLayer] }),
    );

    expect(supported.terrainVisible).toBe(true);
    expect(supported.terrainMode).toBe('tinted');
    expect(unsupported.terrainVisible).toBe(false);
    expect(unsupported.terrainMode).toBe('tinted');
  });

  it('keeps terrain and hydrography distinct despite their shared layer type', () => {
    const layers = [hydrographyLayer, terrainLayer];

    expect(selectHydrographyLayer.projector(layers)?.id).toBe(
      'usgs-3hp-hydrography',
    );
    expect(selectTerrainLayer.projector(layers)?.id).toBe('usgs-3dep-terrain');
    expect(selectTerrainAvailable.projector(terrainLayer)).toBe(true);
    expect(selectTerrainAvailable.projector(undefined)).toBe(false);
  });
});
