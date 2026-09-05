import type {
  DataDrivenPropertyValueSpecification,
  Map as MapLibreMap,
} from 'maplibre-gl';
import type {
  CensusAreaBoundary,
  PopulationEstimatesChoropleth,
} from 'repository-api-client';

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
export type PopulationLegendBreak = {
  readonly label: string;
  readonly color: string;
};

export type PopulationEstimateScale = {
  readonly kind: 'sequential' | 'diverging';
  readonly fillColor: DataDrivenPropertyValueSpecification<string>;
  readonly breaks: readonly PopulationLegendBreak[];
  readonly description: string;
};

const POPULATION_SEQUENTIAL_COLORS = [
  '#eff6ff',
  '#bfdbfe',
  '#60a5fa',
  '#2563eb',
  '#1e3a8a',
] as const;

const POPULATION_DIVERGING_COLORS = [
  '#9a3412',
  '#fdba74',
  '#f8fafc',
  '#93c5fd',
  '#1d4ed8',
] as const;

function populationScaleNumber(value: number, percent: boolean): string {
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: percent ? 2 : 0,
    minimumFractionDigits: 0,
  }).format(value);
}

function populationQuantile(
  sorted: readonly number[],
  probability: number,
): number {
  if (sorted.length === 1) {
    return sorted[0];
  }

  const position = (sorted.length - 1) * probability;
  const lowerIndex = Math.floor(position);
  const upperIndex = Math.ceil(position);

  if (lowerIndex === upperIndex) {
    return sorted[lowerIndex];
  }

  const fraction = position - lowerIndex;
  return (
    sorted[lowerIndex] + (sorted[upperIndex] - sorted[lowerIndex]) * fraction
  );
}

/**
 * Builds the cartographic contract for one Population Estimates response.
 *
 * Population uses deterministic state-level quantile thresholds. Annual change
 * and annual growth use a symmetric diverging scale centered exactly on zero,
 * so identical positive and negative magnitudes have equal visual weight.
 *
 * The returned break model is also intended for the textual legend. The map
 * and semantic explanation therefore cannot silently use different bins.
 */
export function buildPopulationEstimateScale(
  choropleth: PopulationEstimatesChoropleth,
): PopulationEstimateScale {
  const values = choropleth.counties
    .map((county) => county.value)
    .filter((value) => Number.isFinite(value))
    .sort((left, right) => left - right);

  if (values.length === 0) {
    return {
      kind: choropleth.measure === 'POPULATION' ? 'sequential' : 'diverging',
      fillColor: '#cbd5e1',
      breaks: [
        {
          label: 'No mapped numeric values',
          color: '#cbd5e1',
        },
      ],
      description: 'No numeric county values are available for this view.',
    };
  }

  if (choropleth.measure === 'POPULATION') {
    const first = values[0];
    const rawThresholds = [0.2, 0.4, 0.6, 0.8].map((probability) =>
      populationQuantile(values, probability),
    );

    const thresholds = rawThresholds.filter(
      (value, index, all) =>
        value > first && (index === 0 || value > all[index - 1]),
    );

    if (thresholds.length === 0) {
      return {
        kind: 'sequential',
        fillColor: POPULATION_SEQUENTIAL_COLORS[2],
        breaks: [
          {
            label: `All counties: ${populationScaleNumber(first, false)}`,
            color: POPULATION_SEQUENTIAL_COLORS[2],
          },
        ],
        description:
          'All returned counties have the same population value, so one sequential class is used.',
      };
    }

    const expression: unknown[] = [
      'step',
      ['to-number', ['get', 'value']],
      POPULATION_SEQUENTIAL_COLORS[0],
    ];

    thresholds.forEach((threshold, index) => {
      expression.push(
        threshold,
        POPULATION_SEQUENTIAL_COLORS[
          Math.min(index + 1, POPULATION_SEQUENTIAL_COLORS.length - 1)
        ],
      );
    });

    const colors = POPULATION_SEQUENTIAL_COLORS.slice(0, thresholds.length + 1);

    const breaks: PopulationLegendBreak[] = colors.map((color, index) => {
      if (index === 0) {
        return {
          color,
          label: `< ${populationScaleNumber(thresholds[0], false)}`,
        };
      }

      if (index === colors.length - 1) {
        return {
          color,
          label: `≥ ${populationScaleNumber(
            thresholds[thresholds.length - 1],
            false,
          )}`,
        };
      }

      return {
        color,
        label:
          `${populationScaleNumber(thresholds[index - 1], false)} to < ` +
          populationScaleNumber(thresholds[index], false),
      };
    });

    return {
      kind: 'sequential',
      fillColor: expression as DataDrivenPropertyValueSpecification<string>,
      breaks,
      description:
        'Sequential quantile thresholds are derived deterministically from the returned county values; darker blue indicates larger population.',
    };
  }

  const maxAbsolute = Math.max(...values.map((value) => Math.abs(value)));

  if (maxAbsolute === 0) {
    return {
      kind: 'diverging',
      fillColor: POPULATION_DIVERGING_COLORS[2],
      breaks: [
        {
          label: 'No annual change (0)',
          color: POPULATION_DIVERGING_COLORS[2],
        },
      ],
      description:
        'Every returned county is at zero, so the diverging scale collapses to its neutral midpoint.',
    };
  }

  const half = maxAbsolute / 2;
  const percent = choropleth.measure === 'ANNUAL_GROWTH_RATE';

  return {
    kind: 'diverging',
    fillColor: [
      'interpolate',
      ['linear'],
      ['to-number', ['get', 'value']],
      -maxAbsolute,
      POPULATION_DIVERGING_COLORS[0],
      -half,
      POPULATION_DIVERGING_COLORS[1],
      0,
      POPULATION_DIVERGING_COLORS[2],
      half,
      POPULATION_DIVERGING_COLORS[3],
      maxAbsolute,
      POPULATION_DIVERGING_COLORS[4],
    ] as DataDrivenPropertyValueSpecification<string>,
    breaks: [
      {
        label: populationScaleNumber(-maxAbsolute, percent),
        color: POPULATION_DIVERGING_COLORS[0],
      },
      {
        label: populationScaleNumber(-half, percent),
        color: POPULATION_DIVERGING_COLORS[1],
      },
      {
        label: '0',
        color: POPULATION_DIVERGING_COLORS[2],
      },
      {
        label: `+${populationScaleNumber(half, percent)}`,
        color: POPULATION_DIVERGING_COLORS[3],
      },
      {
        label: `+${populationScaleNumber(maxAbsolute, percent)}`,
        color: POPULATION_DIVERGING_COLORS[4],
      },
    ],
    description:
      'Diverging scale centered at zero; orange indicates population loss and blue indicates population growth. Color does not imply statistical significance.',
  };
}

export type MapLayerGroupId =
  | 'tiger'
  | 'earthquake'
  | 'lodes'
  | 'workplace'
  | 'saipe'
  | 'population'
  | 'research'
  | 'hydrography'
  | 'terrain';

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
    id: 'population',
    label: 'County population',
    sourceId: 'population-estimates-county',
    layerIds: [
      'population-estimates-county-fill',
      'population-estimates-county-outline',
    ],
  },
  {
    id: 'research',
    label: 'Data.gov research extents',
    sourceId: 'repository-research-coverage',
    layerIds: [
      'repository-research-coverage-clusters',
      'repository-research-coverage-cluster-count',
      'repository-research-coverage-points',
      'repository-research-coverage-selected-fill',
      'repository-research-coverage-selected-line',
      'repository-research-coverage-selected-anchor',
    ],
  },
  {
    id: 'hydrography',
    label: 'USGS 3HP hydrography',
    sourceId: 'usgs-3hp-hydrography',
    layerIds: ['usgs-3hp-hydrography-raster'],
  },
  {
    id: 'terrain',
    label: 'USGS 3DEP terrain',
    sourceId: 'usgs-3dep-terrain',
    layerIds: ['usgs-3dep-terrain-raster'],
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

export type ResearchCoverageClusterFeature = {
  readonly properties?: Record<string, unknown> | null;
  readonly geometry?: {
    readonly type?: string;
    readonly coordinates?: unknown;
  } | null;
};

/**
 * Expands one rendered Data.gov research cluster.
 *
 * Kept outside the component so the MapLibre interaction contract can be
 * unit-tested without relying on synthetic WebGL mouse coordinates.
 */
export async function expandResearchCoverageCluster(
  map: MapLibreMap,
  feature: ResearchCoverageClusterFeature | null | undefined,
): Promise<boolean> {
  const clusterId = Number(feature?.properties?.['cluster_id']);

  if (
    !Number.isFinite(clusterId) ||
    feature?.geometry?.type !== 'Point' ||
    !Array.isArray(feature.geometry.coordinates)
  ) {
    return false;
  }

  const longitude = Number(feature.geometry.coordinates[0]);
  const latitude = Number(feature.geometry.coordinates[1]);

  if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) {
    return false;
  }

  const source = map.getSource('repository-research-coverage') as
    | {
        getClusterExpansionZoom?: (clusterId: number) => Promise<number>;
      }
    | undefined;

  if (typeof source?.getClusterExpansionZoom !== 'function') {
    return false;
  }

  try {
    const zoom = await source.getClusterExpansionZoom(clusterId);

    if (!Number.isFinite(zoom)) {
      return false;
    }

    map.easeTo({
      center: [longitude, latitude],
      zoom,
    });

    return true;
  } catch {
    return false;
  }
}
