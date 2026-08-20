import type { Map as MapLibreMap } from 'maplibre-gl';
import type { CensusAreaBoundary } from 'repository-api-client';

/** Map zoom must reach this level before panning can auto-select a census area. */
export const MIN_ZOOM_FOR_PAN_AREA_SYNC = 5;

/**
 * The zoom below which the USGS 3HP service draws nothing.
 *
 * 3DHP_all publishes `minScale: 300000`: every layer in it is scale-suppressed when the view is
 * wider than about 1:300,000. A state-level view is nearer 1:5,000,000, so the overlay returned a
 * correctly-formed, entirely empty image and toggling it looked like nothing happened.
 *
 * Web Mercator scale is roughly 559,082,264 / 2^zoom at the equator, which puts 1:300,000 just
 * under zoom 11. Rounded down to 10 because the same scale falls at a lower zoom away from the
 * equator, and asking for one blank tile is cheaper than hiding a band of real data.
 */
export const USGS_3HP_MIN_ZOOM = 10;

/**
 * Proxied ArcGIS MapServer export template for the dynamic 3DHP_all service.
 *
 * MapLibre requests `{bbox-epsg-3857}` tiles through repository-api so the browser never
 * fetches hydro.nationalmap.gov directly (that host does not send CORS headers).
 */
export const USGS_3HP_HYDROGRAPHY_TILE_TEMPLATE =
  '/overlays/usgs/hydrography/export?bbox={bbox-epsg-3857}&bboxSR=3857&imageSR=3857&size=256,256&f=image&transparent=true';

/**
 * Resolves a MapLibre raster tile URL template against the repository API base URL.
 *
 * Rewrites legacy National Map URLs to the proxied export endpoint for backwards compatibility.
 */
export function resolveRasterTileUrlTemplate(
  template: string,
  apiBaseUrl: string,
): string {
  const normalizedBase = apiBaseUrl.replace(/\/$/, '');

  if (template.includes('hydro.nationalmap.gov')) {
    const queryStart = template.indexOf('?');
    const query = queryStart >= 0 ? template.slice(queryStart + 1) : '';
    return `${normalizedBase}/overlays/usgs/hydrography/export?${query}`;
  }

  if (template.startsWith('http://') || template.startsWith('https://')) {
    return template;
  }

  if (template.startsWith('/api/')) {
    const apiRoot = normalizedBase.replace(/\/api$/, '');
    return `${apiRoot}${template}`;
  }

  if (template.startsWith('/')) {
    return `${normalizedBase}${template}`;
  }

  return `${normalizedBase}/${template}`;
}

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

/** The toggles the map exposes. One per checkbox in the layer controls. */
export type MapLayerGroupId =
  | 'tiger'
  | 'earthquake'
  | 'lodes'
  | 'workplace'
  | 'saipe'
  | 'hydrography';

export type MapLayerGroup = {
  readonly id: MapLayerGroupId;
  readonly label: string;
  readonly sourceId: string;
  readonly layerIds: readonly string[];
};

/**
 * Every rendered overlay, grouped by the toggle that owns it.
 *
 * The single definition of which layers belong to which control. Visibility is applied from this,
 * and the debug panel reports from it, so a layer cannot be added to the map without appearing in
 * both. The debug panel previously kept its own list and had already fallen behind by two layers:
 * the earthquake labels and the selection ring were drawn and toggled but never reported.
 *
 * `osm` is deliberately absent. It is the base map, has no toggle, and is never hidden.
 */
export const MAP_LAYER_GROUPS: readonly MapLayerGroup[] = [
  {
    id: 'tiger',
    label: 'TIGER/Line boundary',
    sourceId: 'census-area-boundary',
    layerIds: ['census-area-fill', 'census-area-outline'],
  },
  {
    id: 'earthquake',
    label: 'USGS earthquake overlay',
    sourceId: 'usgs-earthquakes',
    layerIds: [
      'usgs-earthquake-points',
      'usgs-earthquake-labels',
      'usgs-earthquake-selected',
    ],
  },
  {
    id: 'workplace',
    label: 'LODES workplace employment',
    sourceId: 'lodes-workplace-jobs',
    layerIds: ['lodes-workplace-jobs-circles'],
  },
  {
    id: 'lodes',
    label: 'LODES commuting flows',
    sourceId: 'lodes-workplace-flow',
    layerIds: [
      'lodes-workplace-flow-line',
      'lodes-workplace-flow-selected',
      'lodes-workplace-flow-points',
    ],
  },
  {
    id: 'saipe',
    label: 'SAIPE county choropleth',
    sourceId: 'saipe-county-choropleth',
    layerIds: ['saipe-county-fill', 'saipe-county-outline'],
  },
  {
    id: 'hydrography',
    label: 'USGS 3HP hydrography',
    sourceId: 'usgs-3hp-hydrography',
    layerIds: ['usgs-3hp-hydrography-raster'],
  },
];

/**
 * Whether each toggle is currently on.
 *
 * Passed into the snapshot so the panel can say what was asked for next to what the map actually
 * did. The two disagreeing is the interesting case, and the whole reason to look at this panel:
 * a layer that reads `off / visible` is still being drawn after its toggle was cleared.
 */
export type MapLayerToggleState = Record<MapLayerGroupId, boolean>;

export type MapLayerDebugState = {
  id: string;
  visibility: 'visible' | 'none' | 'missing';
};

export type MapLayerGroupDebugState = {
  id: MapLayerGroupId;
  label: string;
  toggledOn: boolean;
  sourceId: string;
  sourceLoaded: boolean;
  featureCount: number;
  layers: readonly MapLayerDebugState[];
  /** True when every layer in the group matches its toggle. */
  matchesToggle: boolean;
};

export type MapDebugSnapshot = {
  mapStyleReady: boolean;
  styleLoaded: boolean;
  layerCount: number;
  groups: readonly MapLayerGroupDebugState[];
  /** Groups whose drawn state disagrees with their toggle; empty is the healthy case. */
  mismatchedGroups: readonly MapLayerGroupId[];
};

function layerVisibility(
  map: MapLibreMap,
  layerId: string,
): MapLayerDebugState['visibility'] {
  if (!map.getLayer(layerId)) {
    return 'missing';
  }

  return map.getLayoutProperty(layerId, 'visibility') === 'none'
    ? 'none'
    : 'visible';
}

function featureCount(map: MapLibreMap, sourceId: string): number {
  try {
    return map.querySourceFeatures(sourceId).length;
  } catch {
    // Raster sources cannot be queried for features; -1 distinguishes that from an empty source.
    return -1;
  }
}

/**
 * Dev-only snapshot of map readiness and, per toggle, what is actually drawn.
 *
 * A layer that has not been added yet reports `missing` rather than `none`. The distinction
 * matters: `none` means the map was told to hide it, `missing` means the data never arrived, and
 * those have different causes.
 */
export function readMapDebugSnapshot(
  map: MapLibreMap | null,
  mapStyleReady: boolean,
  toggles: MapLayerToggleState,
): MapDebugSnapshot | null {
  if (!map) {
    return null;
  }

  const groups = MAP_LAYER_GROUPS.map((group) => {
    const toggledOn = toggles[group.id];
    const layers = group.layerIds.map((layerId) => ({
      id: layerId,
      visibility: layerVisibility(map, layerId),
    }));

    return {
      id: group.id,
      label: group.label,
      toggledOn,
      sourceId: group.sourceId,
      sourceLoaded: map.getSource(group.sourceId)
        ? map.isSourceLoaded(group.sourceId)
        : false,
      featureCount: featureCount(map, group.sourceId),
      layers,
      // A layer still waiting for data is not a mismatch; being drawn when the toggle is off is.
      matchesToggle: layers.every(
        (layer) =>
          layer.visibility === 'missing' ||
          (layer.visibility === 'visible') === toggledOn,
      ),
    };
  });

  return {
    mapStyleReady,
    styleLoaded: map.isStyleLoaded() === true,
    layerCount: map.getStyle().layers.length,
    groups,
    mismatchedGroups: groups
      .filter((group) => !group.matchesToggle)
      .map((group) => group.id),
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
