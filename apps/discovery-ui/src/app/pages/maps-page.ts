import {
  AsyncPipe,
  DatePipe,
  DecimalPipe,
  KeyValuePipe,
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
import { ActivatedRoute, Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Store } from '@ngrx/store';
import { combineLatest, distinctUntilChanged, map } from 'rxjs';
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
  selectTigerVisible,
} from '../state/maps/maps.selectors';
import {
  configureMapLibreWorker,
  readMapDebugSnapshot,
  type MapDebugSnapshot,
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
    KeyValuePipe,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
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
  private map: MapLibreMap | null = null;
  private pendingBoundary: CensusAreaBoundary | null = null;
  private pendingEarthquakeOverlay: UsgsEarthquakeOverlay | null = null;
  private pendingLodesFlowOverlay: LodesFlowOverlay | null = null;
  private pendingSaipeChoropleth: SaipeCountyChoropleth | null = null;
  private pendingHydrographyLayer: MapLayer | null = null;
  /** True once the MapLibre style is parsed; overlays must not wait for raster tiles. */
  private mapStyleReady = false;
  private tigerVisible = true;
  private earthquakeVisible = true;
  private lodesVisible = true;
  private hydrographyVisible = false;
  private saipeVisible = true;
  private selectedFeatureId: string | null = null;
  protected readonly layerTooltips = {
    tiger:
      'Shows the Census TIGER/Line state or area boundary for the selected geography. Helps anchor discovery results to official Census boundaries.',
    lodes:
      'Displays a sample workplace flow from LEHD LODES data—where workers live versus where they work. Demo uses a small API-backed sample for the selected area.',
    saipe:
      'Colors counties by SAIPE poverty rate for the selected state. The county value table below lists the same statistics shown on the map.',
    hydrography:
      'Adds USGS 3D Hydrography Program surface-water context from The National Map. Environmental geography, not Census boundaries.',
    earthquake:
      'Plots recent earthquake epicenters from the USGS FDSN feed near the selected area. Updates from the live API when available.',
  } as const;
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
  protected readonly selectedFeature$ = this.store.select(
    selectSelectedEarthquakeFeature,
  );

  ngOnInit(): void {
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
          this.map?.easeTo({
            center: [feature.longitude, feature.latitude],
            zoom: Math.max(this.map.getZoom(), 6),
            duration: 400,
          });
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
    this.store.dispatch(MapsActions.censusAreaSelected({ geography }));
    this.updateMapUrl({ geography });
  }

  protected toggleMapDebugPanel(): void {
    this.mapDebugPanelOpen.update((open) => !open);
    this.refreshMapDebugSnapshot();
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

    const tileTemplate =
      this.pendingHydrographyLayer.rasterTileUrlTemplate ??
      'https://hydro.nationalmap.gov/arcgis/rest/services/3DHP_all/MapServer/tile/{z}/{y}/{x}';

    if (!this.map.getSource('usgs-3hp-hydrography')) {
      this.map.addSource('usgs-3hp-hydrography', {
        type: 'raster',
        tiles: [tileTemplate],
        tileSize: 256,
        attribution: this.pendingHydrographyLayer.attribution,
      });

      this.map.addLayer(
        {
          id: 'usgs-3hp-hydrography-raster',
          type: 'raster',
          source: 'usgs-3hp-hydrography',
          layout: {
            visibility: this.hydrographyVisible ? 'visible' : 'none',
          },
          paint: {
            'raster-opacity': 0.78,
          },
        },
        'census-area-fill',
      );
    }

    this.applyLayerVisibility();
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
    this.map?.fitBounds(
      [
        [boundary.west, boundary.south],
        [boundary.east, boundary.north],
      ],
      { padding: 56, duration: 500, maxZoom: boundary.defaultZoom },
    );
  }

  private setLayerVisibility(layerIds: string[], visible: boolean): void {
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

    this.setLayerVisibility(
      ['census-area-fill', 'census-area-outline'],
      this.tigerVisible,
    );
    this.setLayerVisibility(
      [
        'usgs-earthquake-points',
        'usgs-earthquake-labels',
        'usgs-earthquake-selected',
      ],
      this.earthquakeVisible,
    );
    this.setLayerVisibility(
      ['lodes-workplace-flow-line', 'lodes-workplace-flow-points'],
      this.lodesVisible,
    );
    this.setLayerVisibility(
      ['saipe-county-fill', 'saipe-county-outline'],
      this.saipeVisible,
    );
    this.setLayerVisibility(
      ['usgs-3hp-hydrography-raster'],
      this.hydrographyVisible,
    );
    this.refreshMapDebugSnapshot();
  }

  private refreshMapDebugSnapshot(): void {
    if (!this.mapDebugAvailable) {
      return;
    }

    this.mapDebugSnapshot = readMapDebugSnapshot(this.map, this.mapStyleReady);
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
