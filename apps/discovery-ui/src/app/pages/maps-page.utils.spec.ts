import type { Map as MapLibreMap } from 'maplibre-gl';
import {
  configureMapLibreWorker,
  findCensusAreaForPoint,
  MAP_LAYER_GROUPS,
  readMapDebugSnapshot,
  resolveRasterTileUrlTemplate,
  USGS_3HP_HYDROGRAPHY_TILE_TEMPLATE,
  whenMapStyleReady,
} from './maps-page.utils';

describe('USGS_3HP_HYDROGRAPHY_TILE_TEMPLATE', () => {
  it('uses the proxied ArcGIS export bbox template', () => {
    expect(USGS_3HP_HYDROGRAPHY_TILE_TEMPLATE).toContain(
      '/overlays/usgs/hydrography/export?bbox={bbox-epsg-3857}',
    );
    expect(USGS_3HP_HYDROGRAPHY_TILE_TEMPLATE).not.toContain(
      'hydro.nationalmap.gov',
    );
    expect(USGS_3HP_HYDROGRAPHY_TILE_TEMPLATE).not.toContain(
      '/tile/{z}/{y}/{x}',
    );
  });
});

describe('resolveRasterTileUrlTemplate', () => {
  it('joins relative API paths to the repository base URL', () => {
    expect(
      resolveRasterTileUrlTemplate(
        '/overlays/usgs/hydrography/export?bbox={bbox-epsg-3857}',
        'http://localhost:8080/api',
      ),
    ).toBe(
      'http://localhost:8080/api/overlays/usgs/hydrography/export?bbox={bbox-epsg-3857}',
    );
  });

  it('rewrites legacy National Map URLs to the proxied export endpoint', () => {
    expect(
      resolveRasterTileUrlTemplate(
        'https://hydro.nationalmap.gov/arcgis/rest/services/3DHP_all/MapServer/export?bbox={bbox-epsg-3857}&size=256,256',
        'http://localhost:8080/api',
      ),
    ).toBe(
      'http://localhost:8080/api/overlays/usgs/hydrography/export?bbox={bbox-epsg-3857}&size=256,256',
    );
  });
});

describe('configureMapLibreWorker', () => {
  it('sets the bundled worker URL', () => {
    const maplibregl = { setWorkerUrl: vi.fn() };

    configureMapLibreWorker(maplibregl);

    expect(maplibregl.setWorkerUrl).toHaveBeenCalledWith(
      '/maplibre-gl-worker.mjs',
    );
  });
});

describe('readMapDebugSnapshot', () => {
  const allOn = {
    tiger: true,
    earthquake: true,
    lodes: true,
    saipe: true,
    hydrography: true,
  };

  function fakeMap(overrides: Record<string, unknown> = {}) {
    return {
      isStyleLoaded: vi.fn().mockReturnValue(true),
      getStyle: vi.fn().mockReturnValue({ layers: [{ id: 'osm' }] }),
      getLayer: vi.fn().mockReturnValue({}),
      getLayoutProperty: vi.fn().mockReturnValue('visible'),
      getSource: vi.fn().mockReturnValue({}),
      isSourceLoaded: vi.fn().mockReturnValue(true),
      querySourceFeatures: vi.fn().mockReturnValue([{}, {}]),
      ...overrides,
    } as unknown as MapLibreMap;
  }

  it('returns null when the map is missing', () => {
    expect(readMapDebugSnapshot(null, false, allOn)).toBeNull();
  });

  /**
   * The panel kept its own layer list and had fallen two behind: the earthquake labels and the
   * selection ring were drawn and toggled but never reported. Reporting every layer in every group
   * is the point.
   */
  it('reports every layer of every group', () => {
    const snapshot = readMapDebugSnapshot(fakeMap(), true, allOn);

    expect(snapshot?.groups.map((group) => group.id)).toEqual(
      MAP_LAYER_GROUPS.map((group) => group.id),
    );
    expect(
      snapshot?.groups.flatMap((group) =>
        group.layers.map((layer) => layer.id),
      ),
    ).toEqual(MAP_LAYER_GROUPS.flatMap((group) => group.layerIds));
  });

  it('carries each toggle position alongside what is drawn', () => {
    const snapshot = readMapDebugSnapshot(fakeMap(), true, {
      ...allOn,
      lodes: false,
    });

    const lodes = snapshot?.groups.find((group) => group.id === 'lodes');
    expect(lodes?.toggledOn).toBe(false);
    // Still drawn while the toggle says off: exactly the disagreement this panel exists to show.
    expect(lodes?.matchesToggle).toBe(false);
    expect(snapshot?.mismatchedGroups).toContain('lodes');
  });

  it('reports a hidden layer as none and treats it as matching an off toggle', () => {
    // Every layer hidden, every toggle off: the state after clearing all the checkboxes.
    const snapshot = readMapDebugSnapshot(
      fakeMap({ getLayoutProperty: vi.fn().mockReturnValue('none') }),
      true,
      {
        tiger: false,
        earthquake: false,
        lodes: false,
        saipe: false,
        hydrography: false,
      },
    );

    // Three layers: the flow lines, the selection highlight drawn over them, and the endpoints.
    const lodes = snapshot?.groups.find((group) => group.id === 'lodes');
    expect(lodes?.layers.map((layer) => layer.visibility)).toEqual([
      'none',
      'none',
      'none',
    ]);
    expect(lodes?.matchesToggle).toBe(true);
    expect(snapshot?.mismatchedGroups).toEqual([]);
  });

  /** A layer whose data has not arrived is missing, not hidden; the causes differ. */
  it('separates a layer that was never added from one that was hidden', () => {
    const snapshot = readMapDebugSnapshot(
      fakeMap({
        getLayer: vi.fn((id: string) =>
          id === 'census-area-fill' ? {} : null,
        ),
      }),
      true,
      allOn,
    );

    const tiger = snapshot?.groups.find((group) => group.id === 'tiger');
    expect(tiger?.layers).toEqual([
      { id: 'census-area-fill', visibility: 'visible' },
      { id: 'census-area-outline', visibility: 'missing' },
    ]);
    // Waiting for data is not a mismatch.
    expect(tiger?.matchesToggle).toBe(true);
  });

  it('reports raster sources that cannot be queried as -1 rather than empty', () => {
    const snapshot = readMapDebugSnapshot(
      fakeMap({
        querySourceFeatures: vi.fn((sourceId: string) => {
          if (sourceId === 'usgs-3hp-hydrography') {
            throw new Error('not a geojson source');
          }
          return [{}, {}];
        }),
      }),
      true,
      allOn,
    );

    expect(
      snapshot?.groups.find((group) => group.id === 'hydrography')
        ?.featureCount,
    ).toBe(-1);
    expect(
      snapshot?.groups.find((group) => group.id === 'tiger')?.featureCount,
    ).toBe(2);
  });
});

describe('findCensusAreaForPoint', () => {
  const boundaries = [
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
      id: 'california',
      label: 'California Census area boundary preview',
      geography: 'California',
      west: -124.4096,
      south: 32.5343,
      east: -114.1312,
      north: 42.0095,
      centerLatitude: 37.2719,
      centerLongitude: -119.2704,
      defaultZoom: 6,
    },
  ];

  it('returns the census area whose bbox contains the point', () => {
    expect(
      findCensusAreaForPoint(boundaries, -101.002, 47.5515)?.geography,
    ).toBe('North Dakota');
    expect(
      findCensusAreaForPoint(boundaries, -119.2704, 37.2719)?.geography,
    ).toBe('California');
  });

  it('returns null when the point is outside every census area', () => {
    expect(findCensusAreaForPoint(boundaries, -130, 40)).toBeNull();
  });
});

describe('whenMapStyleReady', () => {
  it('runs immediately when the style is already loaded', () => {
    const callback = vi.fn();
    const map = {
      isStyleLoaded: vi.fn().mockReturnValue(true),
      once: vi.fn(),
    } as unknown as MapLibreMap;

    whenMapStyleReady(map, callback);

    expect(callback).toHaveBeenCalledTimes(1);
    expect(map.once).not.toHaveBeenCalled();
  });

  it('waits for style.load when the style is not ready yet', () => {
    const callback = vi.fn();
    const listeners = new Map<string, () => void>();
    const map = {
      isStyleLoaded: vi.fn().mockReturnValue(false),
      once: vi.fn((event: string, handler: () => void) => {
        listeners.set(event, handler);
      }),
    } as unknown as MapLibreMap;

    whenMapStyleReady(map, callback);

    expect(callback).not.toHaveBeenCalled();
    expect(map.once).toHaveBeenCalledWith('style.load', expect.any(Function));

    listeners.get('style.load')?.();
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('ignores a missing map instance', () => {
    const callback = vi.fn();

    whenMapStyleReady(null, callback);

    expect(callback).not.toHaveBeenCalled();
  });
});
