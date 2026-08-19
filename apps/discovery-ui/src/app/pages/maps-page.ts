import {
  AsyncPipe,
  DatePipe,
  DecimalPipe,
  isPlatformBrowser,
} from '@angular/common';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  ElementRef,
  OnInit,
  signal,
  OnDestroy,
  PLATFORM_ID,
  ViewChild,
  inject,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Store } from '@ngrx/store';
import { combineLatest, distinctUntilChanged, map } from 'rxjs';
import { LngLatBounds } from 'maplibre-gl';
import type {
  GeoJSONSource,
  Map as MapLibreMap,
  StyleSpecification,
} from 'maplibre-gl';
import type {
  CensusAreaBoundary,
  LodesFlowOverlay,
  MapLayer,
  SaipeCountyChoropleth,
  UsgsEarthquakeOverlay,
} from 'repository-api-client';
import { REPOSITORY_API_BASE_URL } from 'repository-api-client';
import { MapsActions } from '../state/maps/maps.actions';
import {
  selectCensusAreaBoundaries,
  selectEarthquakeError,
  selectEarthquakeOverlay,
  selectEarthquakeVisible,
  selectHydrographyLayer,
  selectHydrographyVisible,
  selectLodesFlowError,
  selectLodesFlowOverlay,
  selectLodesVisible,
  selectMapLayers,
  selectMapsError,
  selectMapsLoading,
  selectSaipeChoropleth,
  selectSaipeChoroplethError,
  selectSaipeVisible,
  selectSelectedCensusAreaBoundary,
  selectSelectedEarthquakeFeature,
  selectSelectedFeatureId,
  selectSelectedGeography,
  selectSelectedLodesFlow,
  selectSelectedLodesFlowId,
  selectTigerVisible,
} from '../state/maps/maps.selectors';
import {
  configureMapLibreWorker,
  findCensusAreaForPoint,
  MIN_ZOOM_FOR_PAN_AREA_SYNC,
  MAP_LAYER_GROUPS,
  USGS_3HP_MIN_ZOOM,
  readMapDebugSnapshot,
  type MapDebugSnapshot,
  type MapLayerToggleState,
  USGS_3HP_HYDROGRAPHY_TILE_TEMPLATE,
  resolveRasterTileUrlTemplate,
  whenMapStyleReady,
} from './maps-page.utils';
import { environment } from '../../environments/environment';

type EarthquakeFeatureCollection = {
  type: 'FeatureCollection';
  features: {
    type: 'Feature';
    properties: {
      place: string;
      magnitude: number;
      occurredAt: string;
    };
    geometry: {
      type: 'Point';
      coordinates: [number, number];
    };
  }[];
};

type BoundaryFeatureCollection = {
  type: 'FeatureCollection';
  features: {
    type: 'Feature';
    properties: {
      label: string;
      geography: string;
    };
    geometry: {
      type: 'Polygon';
      coordinates: [number, number][][];
    };
  }[];
};

type GeoJsonFeatureCollection = {
  type: 'FeatureCollection';
  features: unknown[];
};

@Component({
  selector: 'app-maps-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AsyncPipe,
    DatePipe,
    DecimalPipe,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    RouterLink,
  ],
  templateUrl: './maps-page.html',
})
export class MapsPage implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('mapCanvas', { static: true })
  private readonly mapCanvas!: ElementRef<HTMLDivElement>;

  private readonly platformId = inject(PLATFORM_ID);
  private readonly destroyRef = inject(DestroyRef);
  private readonly changeDetectorRef = inject(ChangeDetectorRef);
  private readonly store = inject(Store);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly repositoryApiBaseUrl = inject(REPOSITORY_API_BASE_URL);
  private map: MapLibreMap | null = null;
  private pendingBoundary: CensusAreaBoundary | null = null;
  private pendingEarthquakeOverlay: UsgsEarthquakeOverlay | null = null;
  private pendingLodesFlowOverlay: LodesFlowOverlay | null = null;
  private pendingSaipeChoropleth: SaipeCountyChoropleth | null = null;
  private pendingHydrographyLayer: MapLayer | null = null;
  /** True once the MapLibre style is parsed; overlays must not wait for raster tiles. */
  private mapStyleReady = false;
  private tigerVisible = false;
  private earthquakeVisible = false;
  private lodesVisible = false;
  private hydrographyVisible = false;
  private saipeVisible = false;
  private selectedFeatureId: string | null = null;
  private selectedLodesFlowId: string | null = null;
  private censusAreaBoundaries: readonly CensusAreaBoundary[] = [];
  private selectedGeography = 'North Dakota';
  /** Skips pan-driven area sync while fitBounds runs after a dropdown change. */
  private skipPanAreaSync = false;
  /** Skips fitBounds while pan-driven area sync updates boundary data in place. */
  private suppressBoundaryFit = false;
  private panAreaSyncTimer: ReturnType<typeof setTimeout> | null = null;
  protected readonly areaSyncAnnouncement = signal<string | null>(null);
  protected readonly layerTooltips = {
    tiger:
      'Shows the Census TIGER/Line state or area boundary for the selected geography. Helps anchor discovery results to official Census boundaries.',
    lodes:
      'Commuting flows from LEHD LODES origin-destination data—where workers live versus where they work. Aggregated from the published block-level file to the largest county-to-county flows for the selected area. States whose published file is too large to derive within a request fall back to a stored sample, which the legend names.',
    saipe:
      'Colors counties by SAIPE poverty rate for the selected state. The county value table below lists the same statistics shown on the map.',
    hydrography:
      'Adds USGS 3D Hydrography Program surface-water context from The National Map. Environmental geography, not Census boundaries.',
    earthquake:
      'Plots recent earthquake epicenters from the USGS FDSN feed near the selected area. Updates from the live API when available.',
  } as const;
  /**
   * True while the hydrography overlay is on but the view is too wide for it to draw anything.
   *
   * Without this the toggle appears broken: the layer is on, the request succeeds, and the map is
   * unchanged, because the USGS service suppresses every layer above 1:300,000.
   */
  protected readonly hydrographyBelowMinZoom = signal(false);
  protected readonly usgsHydrographyMinZoom = USGS_3HP_MIN_ZOOM;
  protected readonly mapDebugAvailable = environment.mapDebugEnabled;
  protected readonly mapDebugPanelOpen = signal(false);
  protected mapDebugSnapshot: MapDebugSnapshot | null = null;

  protected readonly layers$ = this.store.select(selectMapLayers);
  protected readonly hydrographyLayer$ = this.store.select(
    selectHydrographyLayer,
  );
  protected readonly lodesFlowOverlay$ = this.store.select(
    selectLodesFlowOverlay,
  );
  protected readonly lodesFlowError$ = this.store.select(selectLodesFlowError);
  protected readonly saipeChoropleth$ = this.store.select(
    selectSaipeChoropleth,
  );
  protected readonly saipeChoroplethError$ = this.store.select(
    selectSaipeChoroplethError,
  );
  /**
   * The layers currently drawn, for the accessible layer list.
   *
   * Derived from the same toggles the map reads, so the list cannot claim a layer the map is not
   * drawing — the disagreement the layer toggles originally had.
   */
  protected readonly visibleLayers$ = combineLatest([
    this.layers$,
    this.store.select(selectTigerVisible),
    this.store.select(selectEarthquakeVisible),
    this.store.select(selectLodesVisible),
    this.store.select(selectHydrographyVisible),
    this.store.select(selectSaipeVisible),
  ]).pipe(
    map(
      ([
        layers,
        tigerVisible,
        earthquakeVisible,
        lodesVisible,
        hydrographyVisible,
        saipeVisible,
      ]) =>
        layers.filter((layer) => {
          switch (layer.layerType) {
            case 'CENSUS_BOUNDARY':
              return tigerVisible;
            case 'CENSUS_DATA':
              return lodesVisible;
            case 'CENSUS_CHOROPLETH':
              return saipeVisible;
            case 'USGS_EARTHQUAKE':
              return earthquakeVisible;
            case 'USGS_REFERENCE':
              return hydrographyVisible;
            default:
              return true;
          }
        }),
    ),
  );
  protected readonly censusAreaBoundaries$ = this.store.select(
    selectCensusAreaBoundaries,
  );
  protected readonly selectedBoundary$ = this.store.select(
    selectSelectedCensusAreaBoundary,
  );
  protected readonly selectedGeography$ = this.store.select(
    selectSelectedGeography,
  );
  protected readonly earthquakeOverlay$ = this.store.select(
    selectEarthquakeOverlay,
  );
  protected readonly earthquakeError$ = this.store.select(
    selectEarthquakeError,
  );
  protected readonly earthquakeStale$ = this.earthquakeOverlay$.pipe(
    map((overlay) =>
      overlay ? this.isOverlayStale(overlay.staleAfter) : false,
    ),
  );
  protected readonly tigerVisible$ = this.store.select(selectTigerVisible);
  protected readonly earthquakeVisible$ = this.store.select(
    selectEarthquakeVisible,
  );
  protected readonly lodesVisible$ = this.store.select(selectLodesVisible);
  protected readonly hydrographyVisible$ = this.store.select(
    selectHydrographyVisible,
  );
  protected readonly saipeVisible$ = this.store.select(selectSaipeVisible);
  protected readonly loading$ = this.store.select(selectMapsLoading);
  protected readonly error$ = this.store.select(selectMapsError);
  protected readonly selectedFeatureId$ = this.store.select(
    selectSelectedFeatureId,
  );
  protected readonly selectedLodesFlowId$ = this.store.select(
    selectSelectedLodesFlowId,
  );
  protected readonly selectedLodesFlow$ = this.store.select(
    selectSelectedLodesFlow,
  );

  protected readonly selectedFeature$ = this.store.select(
    selectSelectedEarthquakeFeature,
  );

  ngOnInit(): void {
    this.bindResearchContext();
    this.bindUrlState();
    this.store.dispatch(MapsActions.mapOpened());

    this.earthquakeOverlay$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((overlay) => {
        this.pendingEarthquakeOverlay = overlay;
        this.renderEarthquakeOverlay();
      });

    this.selectedBoundary$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((boundary) => {
        this.pendingBoundary = boundary;
        this.renderCensusBoundary();
      });

    this.lodesFlowOverlay$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((overlay) => {
        this.pendingLodesFlowOverlay = overlay;
        this.renderLodesSampleLayer();
      });

    this.saipeChoropleth$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((choropleth) => {
        this.pendingSaipeChoropleth = choropleth;
        this.renderSaipeChoropleth();
      });

    this.hydrographyLayer$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((layer) => {
        this.pendingHydrographyLayer = layer ?? null;
        this.renderHydrographyLayer();
      });

    this.censusAreaBoundaries$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((boundaries) => {
        this.censusAreaBoundaries = boundaries;
      });

    this.selectedGeography$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((geography) => {
        this.selectedGeography = geography;
      });

    // Selection drives the map. The list is the other half of this and sets selection through
    // selectFeature, so either view can originate a change and both reflect it.
    this.selectedFeature$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((feature) => {
        this.selectedFeatureId = feature?.id ?? null;
        this.applySelectionHighlight();

        if (feature) {
          // easeTo, not a focus change: moving the viewport must never move focus away from the
          // control the user is operating.
          this.skipPanAreaSync = true;
          this.map?.easeTo({
            center: [feature.longitude, feature.latitude],
            zoom: Math.max(this.map.getZoom(), 6),
            duration: 400,
          });
        }
      });

    // The same contract as the earthquake selection above: the store is the single place a
    // selection lives, and both the table and the map read from it. Neither writes to the other.
    this.selectedLodesFlow$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((flow) => {
        this.selectedLodesFlowId = flow?.id ?? null;
        this.applyLodesSelectionHighlight();

        if (flow) {
          this.fitSelectedLodesFlow();
        }
      });

    combineLatest([
      this.tigerVisible$,
      this.earthquakeVisible$,
      this.lodesVisible$,
      this.hydrographyVisible$,
      this.saipeVisible$,
    ])
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(
        ([
          tigerVisible,
          earthquakeVisible,
          lodesVisible,
          hydrographyVisible,
          saipeVisible,
        ]) => {
          this.tigerVisible = tigerVisible;
          this.earthquakeVisible = earthquakeVisible;
          this.lodesVisible = lodesVisible;
          this.hydrographyVisible = hydrographyVisible;
          this.saipeVisible = saipeVisible;
          this.applyLayerVisibility();
        },
      );
  }

  ngAfterViewInit(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    void this.initializeMap();
  }

  ngOnDestroy(): void {
    delete (
      this.mapCanvas.nativeElement as HTMLElement & { __map?: MapLibreMap }
    ).__map;
    this.map?.remove();
  }

  protected toggleTigerLayer(visible: boolean): void {
    this.store.dispatch(MapsActions.tigerLayerToggled({ visible }));
    this.updateMapUrl({ tigerVisible: visible });
  }

  protected toggleEarthquakeLayer(visible: boolean): void {
    this.store.dispatch(MapsActions.earthquakeLayerToggled({ visible }));
    this.updateMapUrl({ earthquakeVisible: visible });
  }

  protected toggleLodesLayer(visible: boolean): void {
    this.store.dispatch(MapsActions.lodesLayerToggled({ visible }));
    this.updateMapUrl({ lodesVisible: visible });
  }

  protected toggleHydrographyLayer(visible: boolean): void {
    this.store.dispatch(MapsActions.hydrographyLayerToggled({ visible }));
    this.updateMapUrl({ hydrographyVisible: visible });
  }

  protected toggleSaipeLayer(visible: boolean): void {
    this.store.dispatch(MapsActions.saipeLayerToggled({ visible }));
    this.updateMapUrl({ saipeVisible: visible });
  }

  /** Called when a feature-list entry is activated or focused. */
  /** Selecting the flow already selected clears it, so a row toggles rather than sticking. */
  protected selectLodesFlow(flowId: string): void {
    if (this.selectedLodesFlowId === flowId) {
      this.store.dispatch(MapsActions.lodesFlowSelectionCleared());
      return;
    }

    this.store.dispatch(MapsActions.lodesFlowSelected({ flowId }));
  }

  protected clearLodesFlowSelection(): void {
    this.store.dispatch(MapsActions.lodesFlowSelectionCleared());
  }

  protected flowRowId(flowId: string): string {
    return `lodes-flow-${flowId}`;
  }

  protected selectFeature(featureId: string): void {
    if (this.selectedFeatureId === featureId) {
      return;
    }

    this.store.dispatch(MapsActions.mapFeatureSelected({ featureId }));
    this.updateMapUrl({ featureId });
  }

  protected clearFeatureSelection(): void {
    this.store.dispatch(MapsActions.mapFeatureSelectionCleared());
    this.updateMapUrl({ featureId: null });
  }

  protected featureButtonId(featureId: string): string {
    return `feature-${featureId}`;
  }

  protected selectCensusArea(geography: string): void {
    this.suppressBoundaryFit = false;
    this.store.dispatch(MapsActions.censusAreaSelected({ geography }));
    this.updateMapUrl({ geography });
  }

  private syncCensusAreaFromMapCenter(): void {
    if (
      !this.map ||
      this.skipPanAreaSync ||
      this.censusAreaBoundaries.length === 0
    ) {
      return;
    }

    if (this.map.getZoom() < MIN_ZOOM_FOR_PAN_AREA_SYNC) {
      return;
    }

    const center = this.map.getCenter();
    const match = findCensusAreaForPoint(
      this.censusAreaBoundaries,
      center.lng,
      center.lat,
    );

    if (!match || match.geography === this.selectedGeography) {
      return;
    }

    this.suppressBoundaryFit = true;
    this.store.dispatch(
      MapsActions.censusAreaSelected({ geography: match.geography }),
    );
    this.updateMapUrl({ geography: match.geography });
    this.areaSyncAnnouncement.set(
      `Census area updated to ${match.geography} based on map center.`,
    );
  }

  private schedulePanAreaSync(): void {
    if (this.panAreaSyncTimer !== null) {
      clearTimeout(this.panAreaSyncTimer);
    }

    this.panAreaSyncTimer = setTimeout(() => {
      this.panAreaSyncTimer = null;
      this.syncCensusAreaFromMapCenter();
    }, 300);
  }

  private bindPanAreaSync(): void {
    if (!this.map) {
      return;
    }

    const onMoveEnd = (): void => {
      if (this.skipPanAreaSync) {
        this.skipPanAreaSync = false;
        return;
      }

      this.schedulePanAreaSync();
    };

    const onZoomChanged = (): void => this.refreshHydrographyZoomHint();

    this.map.on('moveend', onMoveEnd);
    this.map.on('zoomend', onZoomChanged);
    onZoomChanged();
    this.destroyRef.onDestroy(() => {
      if (this.panAreaSyncTimer !== null) {
        clearTimeout(this.panAreaSyncTimer);
      }

      this.map?.off('moveend', onMoveEnd);
      this.map?.off('zoomend', onZoomChanged);
    });
  }

  protected toggleMapDebugPanel(): void {
    this.mapDebugPanelOpen.update((open) => !open);
    this.refreshMapDebugSnapshot();
  }

  /**
   * Research context carried in from discovery.
   *
   * The map does not re-run the search and does not read anything out of it: this is only enough
   * to say why the reader is looking at this extent, and to offer a way back. The overlay data
   * still comes from the Maps API, which is the part that has to be authoritative.
   */
  protected readonly workforceView = signal(false);
  protected readonly researchQuery = signal<string | null>(null);

  private bindResearchContext(): void {
    this.route.queryParamMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((params) => {
        this.workforceView.set(params.get('view') === 'workforce');
        const query = params.get('q');
        this.researchQuery.set(query && query.trim() ? query.trim() : null);
      });
  }

  /** Query parameters that reconstruct the discovery search this map was opened from. */
  protected backToSearchParams(): Record<string, string> {
    const query = this.researchQuery();
    return query ? { q: query } : {};
  }

  private bindUrlState(): void {
    this.route.queryParamMap
      .pipe(
        map((params) => ({
          area: params.get('area'),
          tigerVisible: this.toVisibleState(params.get('tiger')),
          earthquakeVisible: this.toVisibleState(params.get('earthquakes')),
          lodesVisible: this.toVisibleState(params.get('lodes')),
          hydrographyVisible: this.toVisibleState(params.get('hydrography')),
          saipeVisible: this.toVisibleState(params.get('saipe')),
          featureId: params.get('feature'),
        })),
        distinctUntilChanged(
          (previous, current) =>
            previous.area === current.area &&
            previous.tigerVisible === current.tigerVisible &&
            previous.earthquakeVisible === current.earthquakeVisible &&
            previous.lodesVisible === current.lodesVisible &&
            previous.hydrographyVisible === current.hydrographyVisible &&
            previous.saipeVisible === current.saipeVisible &&
            previous.featureId === current.featureId,
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(
        ({
          area,
          tigerVisible,
          earthquakeVisible,
          lodesVisible,
          hydrographyVisible,
          saipeVisible,
          featureId,
        }) => {
          if (area) {
            this.store.dispatch(
              MapsActions.censusAreaSelected({ geography: area }),
            );
          }

          if (tigerVisible !== null) {
            this.store.dispatch(
              MapsActions.tigerLayerToggled({ visible: tigerVisible }),
            );
          }

          if (earthquakeVisible !== null) {
            this.store.dispatch(
              MapsActions.earthquakeLayerToggled({
                visible: earthquakeVisible,
              }),
            );
          }

          if (lodesVisible !== null) {
            this.store.dispatch(
              MapsActions.lodesLayerToggled({ visible: lodesVisible }),
            );
          }

          if (hydrographyVisible !== null) {
            this.store.dispatch(
              MapsActions.hydrographyLayerToggled({
                visible: hydrographyVisible,
              }),
            );
          }

          if (saipeVisible !== null) {
            this.store.dispatch(
              MapsActions.saipeLayerToggled({ visible: saipeVisible }),
            );
          }

          if (featureId) {
            this.store.dispatch(MapsActions.mapFeatureSelected({ featureId }));
          }
        },
      );
  }

  private updateMapUrl(options: {
    geography?: string;
    tigerVisible?: boolean;
    earthquakeVisible?: boolean;
    lodesVisible?: boolean;
    hydrographyVisible?: boolean;
    saipeVisible?: boolean;
    featureId?: string | null;
  }): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        area: options.geography === undefined ? undefined : options.geography,
        tiger:
          options.tigerVisible === undefined
            ? undefined
            : this.toLayerParam(options.tigerVisible),
        feature:
          options.featureId === undefined
            ? undefined
            : (options.featureId ?? null),
        earthquakes:
          options.earthquakeVisible === undefined
            ? undefined
            : this.toLayerParam(options.earthquakeVisible),
        lodes:
          options.lodesVisible === undefined
            ? undefined
            : this.toLayerParam(options.lodesVisible),
        hydrography:
          options.hydrographyVisible === undefined
            ? undefined
            : this.toLayerParam(options.hydrographyVisible),
        saipe:
          options.saipeVisible === undefined
            ? undefined
            : this.toLayerParam(options.saipeVisible),
      },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  private toVisibleState(value: string | null): boolean | null {
    if (value === 'off') {
      return false;
    }

    if (value === 'on') {
      return true;
    }

    return null;
  }

  private toLayerParam(visible: boolean): string | null {
    return visible ? null : 'off';
  }

  private isOverlayStale(staleAfter: string): boolean {
    const staleAfterTime = new Date(staleAfter).getTime();

    if (Number.isNaN(staleAfterTime)) {
      return true;
    }

    return Date.now() > staleAfterTime;
  }

  private async initializeMap(): Promise<void> {
    const maplibregl = await import('maplibre-gl');
    configureMapLibreWorker(maplibregl);

    this.map = new maplibregl.Map({
      container: this.mapCanvas.nativeElement,
      style: this.createBaseStyle(),
      center: [-100.469, 47.551],
      zoom: 5,
      maxZoom: 12,
      minZoom: 3,
      // Attribution lives in the accessible feature list; the default MapLibre
      // compact (i) control overlaps the custom legend at bottom-right.
      attributionControl: false,
    });

    // Playwright reads MapLibre layout visibility through this handle; MapLibre has no public DOM lookup.
    (
      this.mapCanvas.nativeElement as HTMLElement & { __map?: MapLibreMap }
    ).__map = this.map;

    this.map.addControl(
      new maplibregl.NavigationControl({ showCompass: false }),
      'top-right',
    );

    // The map half of the two-way binding: activating a feature on the canvas selects it and
    // moves programmatic focus to the matching list entry, so a keyboard or screen-reader user
    // lands on the thing they just selected rather than being left on the canvas.
    this.map.on('click', 'usgs-earthquake-points', (event) => {
      const featureId = event.features?.[0]?.properties?.['id'];
      if (typeof featureId !== 'string') {
        return;
      }

      this.selectFeature(featureId);
      this.focusFeatureButton(featureId);
    });

    // The other half of the two-way selection: clicking a flow line selects it and moves focus to
    // its row, so a sighted mouse user and a keyboard user end up in the same place.
    this.map.on('click', 'lodes-workplace-flow-line', (event) => {
      const flowId = event.features?.[0]?.properties?.['id'];
      if (typeof flowId !== 'string') {
        return;
      }

      this.selectLodesFlow(flowId);
      this.focusFlowRow(flowId);
    });

    this.map.on('mouseenter', 'lodes-workplace-flow-line', () => {
      if (this.map) {
        this.map.getCanvas().style.cursor = 'pointer';
      }
    });

    this.map.on('mouseleave', 'lodes-workplace-flow-line', () => {
      if (this.map) {
        this.map.getCanvas().style.cursor = '';
      }
    });

    this.map.on('mouseenter', 'usgs-earthquake-points', () => {
      if (this.map) {
        this.map.getCanvas().style.cursor = 'pointer';
      }
    });

    this.map.on('mouseleave', 'usgs-earthquake-points', () => {
      if (this.map) {
        this.map.getCanvas().style.cursor = '';
      }
    });

    // Overlays attach on style readiness, not map `load`. Map `load` waits for every raster tile
    // manager; slow or blocked OSM tiles leave mapLoaded false forever, so toggles only move the
    // legend while the canvas stays bare.
    whenMapStyleReady(this.map, () => {
      this.mapStyleReady = true;
      this.syncMapOverlays();
      this.bindMapDebugUpdates();
      this.bindPanAreaSync();
    });
  }

  private bindMapDebugUpdates(): void {
    if (!this.mapDebugAvailable || !this.map) {
      return;
    }

    const refresh = (): void => {
      this.mapDebugSnapshot = readMapDebugSnapshot(
        this.map,
        this.mapStyleReady,
        this.layerToggleState(),
      );
      this.changeDetectorRef.markForCheck();
    };

    refresh();
    this.map.on('idle', refresh);
    this.map.on('sourcedata', refresh);
    this.destroyRef.onDestroy(() => {
      this.map?.off('idle', refresh);
      this.map?.off('sourcedata', refresh);
    });
  }

  private syncMapOverlays(): void {
    if (!this.map || !this.mapStyleReady) {
      return;
    }

    this.renderCensusBoundary();
    this.renderLodesSampleLayer();
    this.renderSaipeChoropleth();
    this.renderHydrographyLayer();
    this.renderEarthquakeOverlay();
    this.applyLayerVisibility();
  }

  private renderCensusBoundary(): void {
    if (!this.map || !this.mapStyleReady || !this.pendingBoundary) {
      return;
    }

    const data = this.createBoundaryGeoJson(this.pendingBoundary);
    const existingSource = this.map.getSource(
      'census-area-boundary',
    ) as GeoJSONSource | null;

    if (existingSource) {
      existingSource.setData(data);
      this.fitSelectedBoundary(this.pendingBoundary);
      this.applyLayerVisibility();
      return;
    }

    this.map.addSource('census-area-boundary', {
      type: 'geojson',
      data,
    });

    this.map.addLayer({
      id: 'census-area-fill',
      type: 'fill',
      source: 'census-area-boundary',
      layout: {
        visibility: this.tigerVisible ? 'visible' : 'none',
      },
      paint: {
        'fill-color': '#0ea5e9',
        'fill-opacity': 0.38,
      },
    });

    this.map.addLayer({
      id: 'census-area-outline',
      type: 'line',
      source: 'census-area-boundary',
      layout: {
        visibility: this.tigerVisible ? 'visible' : 'none',
      },
      paint: {
        'line-color': '#0369a1',
        'line-width': 3,
      },
    });

    this.fitSelectedBoundary(this.pendingBoundary);
    this.applyLayerVisibility();
  }

  private renderEarthquakeOverlay(): void {
    if (!this.map || !this.mapStyleReady || !this.pendingEarthquakeOverlay) {
      return;
    }

    const data = this.createEarthquakeGeoJson(this.pendingEarthquakeOverlay);
    const existingSource = this.map.getSource(
      'usgs-earthquakes',
    ) as GeoJSONSource | null;

    if (existingSource) {
      existingSource.setData(data);
      this.applyLayerVisibility();
      return;
    }

    this.map.addSource('usgs-earthquakes', {
      type: 'geojson',
      data,
    });

    this.map.addLayer({
      id: 'usgs-earthquake-points',
      type: 'circle',
      source: 'usgs-earthquakes',
      layout: {
        visibility: this.earthquakeVisible ? 'visible' : 'none',
      },
      paint: {
        'circle-color': '#b45309',
        'circle-radius': [
          'interpolate',
          ['linear'],
          ['get', 'magnitude'],
          0,
          8,
          1,
          10,
          3,
          18,
        ],
        'circle-opacity': 0.95,
        'circle-stroke-color': '#ffffff',
        'circle-stroke-width': 3,
      },
    });

    this.map.addLayer({
      id: 'usgs-earthquake-labels',
      type: 'symbol',
      source: 'usgs-earthquakes',
      layout: {
        visibility: this.earthquakeVisible ? 'visible' : 'none',
        'text-field': ['concat', 'M ', ['to-string', ['get', 'magnitude']]],
        'text-size': 12,
        'text-offset': [0, 1.4],
        'text-anchor': 'top',
      },
      paint: {
        'text-color': '#7c2d12',
        'text-halo-color': '#ffffff',
        'text-halo-width': 2,
      },
    });

    this.map.addLayer({
      id: 'usgs-earthquake-selected',
      type: 'circle',
      source: 'usgs-earthquakes',
      layout: {
        visibility: this.earthquakeVisible ? 'visible' : 'none',
      },
      // Selection is conveyed by an outline ring and a wider stroke, not by color alone.
      filter: ['==', ['get', 'id'], ''],
      paint: {
        'circle-color': 'rgba(0, 0, 0, 0)',
        'circle-radius': [
          'interpolate',
          ['linear'],
          ['get', 'magnitude'],
          0,
          14,
          1,
          16,
          3,
          24,
        ],
        'circle-stroke-color': '#1d4ed8',
        'circle-stroke-width': 4,
      },
    });

    this.applyLayerVisibility();
    this.applySelectionHighlight();
  }

  private applySelectionHighlight(): void {
    if (!this.map || !this.map.getLayer('usgs-earthquake-selected')) {
      return;
    }

    this.map.setFilter('usgs-earthquake-selected', [
      '==',
      ['get', 'id'],
      this.selectedFeatureId ?? '',
    ]);
  }

  /**
   * Draws the selected flow with a heavier line, rather than hiding the others.
   *
   * A filter that showed only the selection would answer "where is this flow" by removing the
   * context that makes it meaningful. The highlight layer sits above the base line layer and
   * matches nothing when there is no selection.
   */
  private applyLodesSelectionHighlight(): void {
    if (!this.map || !this.map.getLayer('lodes-workplace-flow-selected')) {
      return;
    }

    this.map.setFilter('lodes-workplace-flow-selected', [
      'all',
      ['==', ['geometry-type'], 'LineString'],
      ['==', ['get', 'id'], this.selectedLodesFlowId ?? ''],
    ]);
  }

  /**
   * Brings the selected flow into view, from the geometry the map source already holds.
   *
   * The flow summary carries labels and a worker count, not coordinates, and widening the contract
   * so the client could pan would put geometry in a field that exists to be read aloud. The line
   * is already in the source; its bounds come from there.
   */
  private fitSelectedLodesFlow(): void {
    if (
      !this.map ||
      !this.selectedLodesFlowId ||
      !this.map.getSource('lodes-workplace-flow')
    ) {
      return;
    }

    const feature = this.map
      .querySourceFeatures('lodes-workplace-flow')
      .find(
        (candidate) =>
          candidate.properties?.['id'] === this.selectedLodesFlowId &&
          candidate.geometry?.type === 'LineString',
      );

    const coordinates = (
      feature?.geometry as { coordinates?: [number, number][] } | undefined
    )?.coordinates;
    if (!coordinates || coordinates.length === 0) {
      return;
    }

    const bounds = coordinates.reduce(
      (accumulated, coordinate) => accumulated.extend(coordinate),
      new LngLatBounds(coordinates[0], coordinates[0]),
    );

    // fitBounds, not a focus change: moving the viewport must not move focus away from the row
    // the reader is operating.
    this.skipPanAreaSync = true;
    this.map.fitBounds(bounds, { padding: 80, duration: 400, maxZoom: 9 });
  }

  private focusFlowRow(flowId: string): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    setTimeout(() => {
      document.getElementById(this.flowRowId(flowId))?.focus();
    });
  }

  private focusFeatureButton(featureId: string): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    // Deferred so the button exists after change detection renders the new selected state.
    setTimeout(() => {
      document.getElementById(this.featureButtonId(featureId))?.focus();
    });
  }

  private renderLodesSampleLayer(): void {
    if (!this.map || !this.mapStyleReady || !this.pendingLodesFlowOverlay) {
      return;
    }

    const data = this.pendingLodesFlowOverlay
      .geoJson as GeoJsonFeatureCollection;
    const existingSource = this.map.getSource(
      'lodes-workplace-flow',
    ) as GeoJSONSource | null;

    if (existingSource) {
      existingSource.setData(data);
      this.applyLayerVisibility();
      return;
    }

    this.map.addSource('lodes-workplace-flow', {
      type: 'geojson',
      data,
    });

    this.map.addLayer({
      id: 'lodes-workplace-flow-line',
      type: 'line',
      source: 'lodes-workplace-flow',
      filter: ['==', ['geometry-type'], 'LineString'],
      layout: {
        visibility: this.lodesVisible ? 'visible' : 'none',
      },
      paint: {
        'line-color': '#7c3aed',
        'line-width': 5,
        'line-opacity': 0.92,
      },
    });

    // Above the base line layer, filtered to the selection. Added even when nothing is selected,
    // so the filter has something to update rather than the layer having to be created lazily.
    this.map.addLayer({
      id: 'lodes-workplace-flow-selected',
      type: 'line',
      source: 'lodes-workplace-flow',
      filter: [
        'all',
        ['==', ['geometry-type'], 'LineString'],
        ['==', ['get', 'id'], this.selectedLodesFlowId ?? ''],
      ],
      layout: {
        visibility: this.lodesVisible ? 'visible' : 'none',
      },
      paint: {
        'line-color': '#f59e0b',
        'line-width': 9,
        'line-opacity': 1,
      },
    });

    this.map.addLayer({
      id: 'lodes-workplace-flow-points',
      type: 'circle',
      source: 'lodes-workplace-flow',
      filter: ['==', ['geometry-type'], 'Point'],
      layout: {
        visibility: this.lodesVisible ? 'visible' : 'none',
      },
      paint: {
        'circle-color': '#7c3aed',
        'circle-radius': 8,
        'circle-stroke-color': '#ffffff',
        'circle-stroke-width': 2,
      },
    });

    this.applyLayerVisibility();
    // The layers were just recreated, so the highlight filter has to be reapplied: a selection
    // made before a geography change would otherwise survive in state and vanish from the map.
    this.applyLodesSelectionHighlight();
  }

  private renderSaipeChoropleth(): void {
    if (!this.map || !this.mapStyleReady || !this.pendingSaipeChoropleth) {
      return;
    }

    const data = this.pendingSaipeChoropleth
      .geoJson as GeoJsonFeatureCollection;
    const existingSource = this.map.getSource(
      'saipe-county-choropleth',
    ) as GeoJSONSource | null;

    if (existingSource) {
      existingSource.setData(data);
      this.applyLayerVisibility();
      return;
    }

    this.map.addSource('saipe-county-choropleth', {
      type: 'geojson',
      data,
    });

    this.map.addLayer(
      {
        id: 'saipe-county-fill',
        type: 'fill',
        source: 'saipe-county-choropleth',
        layout: {
          visibility: this.saipeVisible ? 'visible' : 'none',
        },
        paint: {
          'fill-color': [
            'interpolate',
            ['linear'],
            ['get', 'povertyRate'],
            6,
            '#fef3c7',
            12,
            '#f59e0b',
            20,
            '#b45309',
            30,
            '#7c2d12',
          ],
          'fill-opacity': 0.72,
        },
      },
      'census-area-fill',
    );

    this.map.addLayer({
      id: 'saipe-county-outline',
      type: 'line',
      source: 'saipe-county-choropleth',
      layout: {
        visibility: this.saipeVisible ? 'visible' : 'none',
      },
      paint: {
        'line-color': '#78350f',
        'line-width': 1.5,
      },
    });

    this.applyLayerVisibility();
  }

  private renderHydrographyLayer(): void {
    if (!this.map || !this.mapStyleReady || !this.pendingHydrographyLayer) {
      return;
    }

    const tileTemplate = resolveRasterTileUrlTemplate(
      this.pendingHydrographyLayer.rasterTileUrlTemplate ??
        USGS_3HP_HYDROGRAPHY_TILE_TEMPLATE,
      this.repositoryApiBaseUrl,
    );

    if (!this.map.getSource('usgs-3hp-hydrography')) {
      this.map.addSource('usgs-3hp-hydrography', {
        type: 'raster',
        tiles: [tileTemplate],
        tileSize: 256,
        attribution: this.pendingHydrographyLayer.attribution,
      });
    }

    if (!this.map.getLayer('usgs-3hp-hydrography-raster')) {
      this.map.addLayer(
        {
          id: 'usgs-3hp-hydrography-raster',
          type: 'raster',
          source: 'usgs-3hp-hydrography',
          // Below this the service returns blank images, so requesting them wastes a round trip
          // per tile and tells the user nothing.
          minzoom: USGS_3HP_MIN_ZOOM,
          layout: {
            visibility: this.hydrographyVisible ? 'visible' : 'none',
          },
          paint: {
            'raster-opacity': 0.85,
          },
        },
        this.overlayInsertBeforeId(),
      );
    }

    this.applyLayerVisibility();
  }

  /** Inserts vector overlays above the OSM basemap when census layers are not ready yet. */
  private overlayInsertBeforeId(): string | undefined {
    if (this.map?.getLayer('census-area-fill')) {
      return 'census-area-fill';
    }

    return undefined;
  }

  private createEarthquakeGeoJson(
    overlay: UsgsEarthquakeOverlay,
  ): EarthquakeFeatureCollection {
    return {
      type: 'FeatureCollection',
      features: overlay.features.map((feature) => ({
        type: 'Feature',
        properties: {
          id: feature.id,
          place: feature.place,
          magnitude: feature.magnitude,
          occurredAt: feature.occurredAt,
        },
        geometry: {
          type: 'Point',
          coordinates: [feature.longitude, feature.latitude],
        },
      })),
    };
  }

  private createBoundaryGeoJson(
    boundary: CensusAreaBoundary,
  ): BoundaryFeatureCollection {
    return {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: {
            label: boundary.label,
            geography: boundary.geography,
          },
          geometry: {
            type: 'Polygon',
            coordinates: [
              [
                [boundary.west, boundary.south],
                [boundary.east, boundary.south],
                [boundary.east, boundary.north],
                [boundary.west, boundary.north],
                [boundary.west, boundary.south],
              ],
            ],
          },
        },
      ],
    };
  }

  private fitSelectedBoundary(boundary: CensusAreaBoundary): void {
    if (this.suppressBoundaryFit) {
      this.suppressBoundaryFit = false;
      return;
    }

    this.skipPanAreaSync = true;
    this.map?.fitBounds(
      [
        [boundary.west, boundary.south],
        [boundary.east, boundary.north],
      ],
      { padding: 56, duration: 500, maxZoom: boundary.defaultZoom },
    );
  }

  private setLayerVisibility(
    layerIds: readonly string[],
    visible: boolean,
  ): void {
    if (!this.map) {
      return;
    }

    const visibility = visible ? 'visible' : 'none';

    for (const layerId of layerIds) {
      if (!this.map.getLayer(layerId)) {
        continue;
      }

      try {
        this.map.setLayoutProperty(layerId, 'visibility', visibility);
      } catch (error) {
        console.warn(
          `Failed to set visibility for map layer "${layerId}"`,
          error,
        );
      }
    }

    this.map.triggerRepaint();
  }

  /**
   * The single place layer visibility is applied.
   *
   * Every rendered layer belongs to exactly one group here. The earthquake selection ring was
   * missing, so hiding the overlay left a highlight floating over an empty map, and the LODES
   * layers had no toggle at all and were drawn permanently. That is why turning a layer off
   * appeared to change only the legend: the legend read from the store, the map did not.
   */
  private applyLayerVisibility(): void {
    if (!this.map || !this.mapStyleReady) {
      return;
    }

    const toggles = this.layerToggleState();
    for (const group of MAP_LAYER_GROUPS) {
      this.setLayerVisibility(group.layerIds, toggles[group.id]);
    }

    this.refreshMapDebugSnapshot();
  }

  private refreshHydrographyZoomHint(): void {
    const belowMinZoom =
      this.hydrographyVisible && (this.map?.getZoom() ?? 0) < USGS_3HP_MIN_ZOOM;

    if (belowMinZoom !== this.hydrographyBelowMinZoom()) {
      this.hydrographyBelowMinZoom.set(belowMinZoom);
      this.changeDetectorRef.markForCheck();
    }
  }

  /** The current toggle positions, keyed the way MAP_LAYER_GROUPS is. */
  private layerToggleState(): MapLayerToggleState {
    return {
      tiger: this.tigerVisible,
      earthquake: this.earthquakeVisible,
      lodes: this.lodesVisible,
      saipe: this.saipeVisible,
      hydrography: this.hydrographyVisible,
    };
  }

  private refreshMapDebugSnapshot(): void {
    if (!this.mapDebugAvailable) {
      return;
    }

    this.mapDebugSnapshot = readMapDebugSnapshot(
      this.map,
      this.mapStyleReady,
      this.layerToggleState(),
    );
    this.changeDetectorRef.markForCheck();
  }

  private createBaseStyle(): StyleSpecification {
    return {
      version: 8,
      glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
      sources: {
        osm: {
          type: 'raster',
          tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
          tileSize: 256,
          attribution: '© OpenStreetMap contributors',
        },
      },
      layers: [
        {
          id: 'osm',
          type: 'raster',
          source: 'osm',
        },
      ],
    };
  }
}
