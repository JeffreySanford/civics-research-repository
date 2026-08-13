import type { Map as MapLibreMap } from 'maplibre-gl';
import {
  configureMapLibreWorker,
  findCensusAreaForPoint,
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
  it('returns null when the map is missing', () => {
    expect(readMapDebugSnapshot(null, false)).toBeNull();
  });

  it('summarizes layer visibility and source feature counts', () => {
    const map = {
      isStyleLoaded: vi.fn().mockReturnValue(true),
      getStyle: vi.fn().mockReturnValue({ layers: [{ id: 'osm' }] }),
      getLayer: vi.fn((id: string) => (id === 'census-area-fill' ? {} : null)),
      getLayoutProperty: vi.fn().mockReturnValue('visible'),
      getSource: vi.fn().mockReturnValue({}),
      isSourceLoaded: vi.fn().mockReturnValue(true),
      querySourceFeatures: vi.fn().mockReturnValue([{}, {}]),
    } as unknown as MapLibreMap;

    expect(readMapDebugSnapshot(map, true)).toEqual(
      expect.objectContaining({
        mapStyleReady: true,
        styleLoaded: true,
        layerCount: 1,
        featureCounts: expect.objectContaining({
          'census-area-boundary': 2,
        }),
        visibility: expect.objectContaining({
          'census-area-fill': 'visible',
          'census-area-outline': 'missing',
        }),
      }),
    );
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
