import type { Map as MapLibreMap } from 'maplibre-gl';
import type { CensusAreaBoundary } from 'repository-api-client';

/** Map zoom must reach this level before panning can auto-select a census area. */
export const MIN_ZOOM_FOR_PAN_AREA_SYNC = 5;

/**
 * ArcGIS MapServer export template for the dynamic 3DHP_all service.
 *
 * That service has no fused tile cache, so `/tile/{z}/{y}/{x}` always 404s. MapLibre requests
 * `{bbox-epsg-3857}` tiles through `/export` instead.
 */
export const USGS_3HP_HYDROGRAPHY_TILE_TEMPLATE =
  'https://hydro.nationalmap.gov/arcgis/rest/services/3DHP_all/MapServer/export?bbox={bbox-epsg-3857}&bboxSR=3857&imageSR=3857&size=256,256&f=image&transparent=true';

/** MapLibre module shape used when configuring the GeoJSON worker. */
export type MapLibreModule = {
  setWorkerUrl: (url: string) => void;
};

/**
 * Points MapLibre at the bundled worker script.
 *
 * Without this, Vite serves the app from `/` but the worker 404s at
 * `/maplibre-gl-worker.mjs` (and its `./maplibre-gl-shared.mjs` import). GeoJSON
 * sources never index in the worker, so layout visibility toggles and the legend
 * update while the canvas stays bare.
 */
export function configureMapLibreWorker(maplibregl: MapLibreModule): void {
  maplibregl.setWorkerUrl('/maplibre-gl-worker.mjs');
}

export type MapDebugSnapshot = {
  mapStyleReady: boolean;
  styleLoaded: boolean;
  layerCount: number;
  featureCounts: Record<string, number>;
  visibility: Record<string, 'visible' | 'none' | 'missing'>;
  geoJsonSourcesLoaded: Record<string, boolean>;
};

const DEBUG_LAYER_IDS = [
  'census-area-fill',
  'census-area-outline',
  'saipe-county-fill',
  'saipe-county-outline',
  'usgs-3hp-hydrography-raster',
  'usgs-earthquake-points',
  'lodes-workplace-flow-line',
  'lodes-workplace-flow-points',
] as const;

const DEBUG_SOURCE_IDS = [
  'census-area-boundary',
  'saipe-county-choropleth',
  'usgs-3hp-hydrography',
  'usgs-earthquakes',
  'lodes-workplace-flow',
] as const;

/** Dev-only snapshot of map readiness, source data, and layer visibility. */
export function readMapDebugSnapshot(
  map: MapLibreMap | null,
  mapStyleReady: boolean,
): MapDebugSnapshot | null {
  if (!map) {
    return null;
  }

  const featureCounts = Object.fromEntries(
    DEBUG_SOURCE_IDS.map((sourceId) => {
      try {
        return [sourceId, map.querySourceFeatures(sourceId).length];
      } catch {
        return [sourceId, -1];
      }
    }),
  );

  const visibility = Object.fromEntries(
    DEBUG_LAYER_IDS.map((layerId) => {
      if (!map.getLayer(layerId)) {
        return [layerId, 'missing' as const];
      }

      const value = map.getLayoutProperty(layerId, 'visibility');
      return [
        layerId,
        value === 'none' ? ('none' as const) : ('visible' as const),
      ];
    }),
  );

  const geoJsonSourcesLoaded = Object.fromEntries(
    DEBUG_SOURCE_IDS.map((sourceId) => [
      sourceId,
      map.getSource(sourceId) ? map.isSourceLoaded(sourceId) : false,
    ]),
  );

  return {
    mapStyleReady,
    styleLoaded: map.isStyleLoaded() === true,
    layerCount: map.getStyle().layers.length,
    featureCounts,
    visibility,
    geoJsonSourcesLoaded,
  };
}

/**
 * Runs once the map style is parsed and ready for addSource/addLayer.
 *
 * Do not wait on map `load` or `loaded()`: those require every raster tile manager to finish,
 * which can stall indefinitely when OSM tiles are slow or blocked. Overlays must attach on
 * `style.load` instead so toggles and legend stay aligned with the canvas.
 *
 * Use `isStyleLoaded()`, not `getStyle()`: the style object can exist before the style is ready,
 * and `style.load` may have already fired before a listener is attached.
 */
/** Returns the census area whose bounding box contains the point, if any. */
export function findCensusAreaForPoint(
  boundaries: readonly CensusAreaBoundary[],
  longitude: number,
  latitude: number,
): CensusAreaBoundary | null {
  const matches = boundaries.filter(
    (boundary) =>
      longitude >= boundary.west &&
      longitude <= boundary.east &&
      latitude >= boundary.south &&
      latitude <= boundary.north,
  );

  if (matches.length === 0) {
    return null;
  }

  return matches.reduce((smallest, current) => {
    const smallestArea =
      (smallest.east - smallest.west) * (smallest.north - smallest.south);
    const currentArea =
      (current.east - current.west) * (current.north - current.south);

    return currentArea < smallestArea ? current : smallest;
  });
}

export function whenMapStyleReady(
  map: MapLibreMap | null,
  callback: () => void,
): void {
  if (!map) {
    return;
  }

  if (map.isStyleLoaded()) {
    callback();
    return;
  }

  map.once('style.load', callback);
}
