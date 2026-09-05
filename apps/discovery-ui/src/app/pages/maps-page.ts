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
  DataDrivenPropertyValueSpecification,
  GeoJSONSource,
  Map as MapLibreMap,
  StyleSpecification,
} from 'maplibre-gl';
import type {
  CensusAreaBoundary,
  LodesFlowOverlay,
  LodesWorkplaceOverlay,
  MapLayer,
  PopulationEstimateMeasure,
  PopulationEstimatesChoropleth,
  ResearchObjectType,
  ResearchSpatialCoverageFeature,
  ResearchSpatialViewport,
  SaipeCountyChoropleth,
  SearchQuery,
  SourceSystem,
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
  selectPopulationEstimateMeasure,
  selectPopulationEstimatesAvailable,
  selectPopulationEstimatesChoropleth,
  selectPopulationEstimatesError,
  selectPopulationEstimatesLoading,
  selectPopulationEstimateYear,
  selectPopulationVisible,
  selectResearchCoverageError,
  selectResearchCoverageLoading,
  selectResearchCoverageSummary,
  selectResearchCoverageVisible,
  selectSelectedResearchCoverageId,
  selectSaipeAvailable,
  selectSaipeChoropleth,
  selectSaipeChoroplethError,
  selectSaipeVisible,
  selectSelectedCensusAreaBoundary,
  selectSelectedEarthquakeFeature,
  selectLodesWorkplaceError,
  selectLodesWorkplaceOverlay,
  selectSelectedFeatureId,
  selectSelectedGeography,
  selectWorkplaceVisible,
  selectSelectedLodesFlow,
  selectSelectedLodesFlowId,
  selectTigerVisible,
} from '../state/maps/maps.selectors';
import type { ResearchCoverageSummary } from '../state/maps/research-coverage';
import { PopulationEstimatesSummaryComponent } from './population-estimates-summary.component';
import { ResearchCoverageSummaryComponent } from './research-coverage-summary.component';
import {
  buildPopulationEstimateScale,
  configureMapLibreWorker,
  expandResearchCoverageCluster,
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

type ResearchCoverageFeatureCollection = {
  type: 'FeatureCollection';
  features: {
    type: 'Feature';
    properties: {
      sourceIdentifier: string;
      title: string;
      publisher: string | null;
      program: string | null;
      contentType: string | null;
      sourceUrl: string | null;
      geometryStatus: string;
      renderPointMethod: string | null;
      mapRendering: 'RENDER_ANCHOR' | 'ANTIMERIDIAN_ANCHOR';
    };
    geometry: {
      type: 'Point';
      coordinates: [number, number];
    };
  }[];
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
    PopulationEstimatesSummaryComponent,
    ResearchCoverageSummaryComponent,
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
  private pendingLodesWorkplaceOverlay: LodesWorkplaceOverlay | null = null;
  private pendingSaipeChoropleth: SaipeCountyChoropleth | null = null;
  private pendingPopulationEstimates: PopulationEstimatesChoropleth | null =
    null;
  private pendingHydrographyLayer: MapLayer | null = null;
  private pendingResearchCoverage: ResearchCoverageSummary | null = null;
  /** True once the MapLibre style is parsed; overlays must not wait for raster tiles. */
  private mapStyleReady = false;
  private tigerVisible = false;
  private earthquakeVisible = false;
  private lodesVisible = false;
  private hydrographyVisible = false;
  private saipeVisible = false;
  private populationVisible = false;
  private populationEstimateMeasure: PopulationEstimateMeasure =
    'ANNUAL_GROWTH_RATE';
  private populationEstimateYear = 2025;
  private researchCoverageVisible = false;
  private selectedResearchCoverageId: string | null = null;
  private selectedFeatureId: string | null = null;
  private selectedLodesFlowId: string | null = null;
  private workplaceVisible = false;
  private censusAreaBoundaries: readonly CensusAreaBoundary[] = [];
  private selectedGeography = 'North Dakota';
  private researchCoverageCriteria: SearchQuery = {};
  private researchCoverageCriteriaFingerprint = '';
  private researchCoverageRequestFingerprint = '';
  /** Skips pan-driven area sync while fitBounds runs after a dropdown change. */
  private skipPanAreaSync = false;
  /** Skips fitBounds while pan-driven area sync updates boundary data in place. */
  private suppressBoundaryFit = false;
  private panAreaSyncTimer: ReturnType<typeof setTimeout> | null = null;
  private researchCoverageRefreshTimer: ReturnType<typeof setTimeout> | null =
    null;
  protected readonly areaSyncAnnouncement = signal<string | null>(null);
  /**
   * How the map is built, on a control the reader has to ask.
   *
   * <p>Closed by default and reachable from one icon beside the heading: a reader who wants to
   * compare these numbers against Census needs to know they are derived rather than published as
   * shown, and a reader who does not should not have a paragraph of provenance in their way.
   */
  protected readonly methodologyTooltip =
    'Boundaries are Census TIGER/Line. Commuting flows and workplace employment are aggregated ' +
    'from the published LEHD LODES files for the selected area: block-level records summed to ' +
    'counties, with names and interior points from the Census Gazetteer. Commuting lines drop ' +
    'county-to-itself pairs and keep the largest few; circle area is proportional to the ' +
    'county job count. 2023 is the newest LODES vintage the Census Bureau publishes. Where a ' +
    'file is too large to derive within a request, the legend says the flows are a stored sample.';

  protected readonly layerTooltips = {
    tiger:
      'Shows the Census TIGER/Line state or area boundary for the selected geography. Helps anchor discovery results to official Census boundaries.',
    lodes:
      'Commuting flows from LEHD LODES origin-destination data—where workers live versus where they work. Aggregated from the published block-level file to the largest county-to-county flows for the selected area. States whose published file is too large to derive within a request fall back to a stored sample, which the legend names.',
    workplace:
      'Jobs counted where they are worked, from LEHD LODES Workplace Area Characteristics. Circle area is proportional to the county job count, so a circle twice the area holds twice the jobs. Pairs with the commuting flows: one shows where the work is, the other who travels to it.',
    saipe:
      'Colors counties by SAIPE poverty rate for the selected state. The county value table below lists the same statistics shown on the map.',
    population:
      'Colors counties using Census Population Estimates Program Vintage 2025 values. Population uses a sequential scale; annual change and annual growth use a diverging scale centered at zero. Colors do not imply statistical significance.',
    research:
      'Shows spatial extents declared in Data.gov metadata. Map points are deterministic display anchors for those extents, not observation sites or data-collection locations. Publisher, laboratory, author, and institution addresses are never substituted for missing research geometry.',
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
  protected readonly saipeAvailable$ = this.store.select(selectSaipeAvailable);
  protected readonly populationAvailable$ = this.store.select(
    selectPopulationEstimatesAvailable,
  );
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
  protected readonly populationEstimatesChoropleth$ = this.store.select(
    selectPopulationEstimatesChoropleth,
  );
  protected readonly populationScale$ =
    this.populationEstimatesChoropleth$.pipe(
      map((choropleth) =>
        choropleth ? buildPopulationEstimateScale(choropleth) : null,
      ),
    );

  protected readonly populationYears = [
    2020, 2021, 2022, 2023, 2024, 2025,
  ] as const;

  protected readonly populationChangeYears = [
    2021, 2022, 2023, 2024, 2025,
  ] as const;

  protected readonly populationEstimatesError$ = this.store.select(
    selectPopulationEstimatesError,
  );
  protected readonly populationEstimatesLoading$ = this.store.select(
    selectPopulationEstimatesLoading,
  );
  protected readonly populationEstimateMeasure$ = this.store.select(
    selectPopulationEstimateMeasure,
  );
  protected readonly populationEstimateYear$ = this.store.select(
    selectPopulationEstimateYear,
  );
  protected readonly populationVisible$ = this.store.select(
    selectPopulationVisible,
  );

  protected readonly researchCoverageSummary$ = this.store.select(
    selectResearchCoverageSummary,
  );
  protected readonly researchCoverageLoading$ = this.store.select(
    selectResearchCoverageLoading,
  );
  protected readonly researchCoverageError$ = this.store.select(
    selectResearchCoverageError,
  );
  protected readonly researchCoverageVisible$ = this.store.select(
    selectResearchCoverageVisible,
  );
  protected readonly selectedResearchCoverageId$ = this.store.select(
    selectSelectedResearchCoverageId,
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
    this.store.select(selectPopulationVisible),
  ]).pipe(
    map(
      ([
        layers,
        tigerVisible,
        earthquakeVisible,
        lodesVisible,
        hydrographyVisible,
        saipeVisible,
        populationVisible,
      ]) =>
        layers.filter((layer) => {
          switch (layer.layerType) {
            case 'CENSUS_BOUNDARY':
              return tigerVisible;
            case 'CENSUS_DATA':
              return lodesVisible;
            case 'CENSUS_CHOROPLETH':
              if (layer.id.startsWith('saipe-county-poverty-')) {
                return saipeVisible;
              }
              if (layer.id.startsWith('population-estimates-county-')) {
                return populationVisible;
              }
              return false;
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
  protected readonly lodesWorkplaceOverlay$ = this.store.select(
    selectLodesWorkplaceOverlay,
  );
  protected readonly lodesWorkplaceError$ = this.store.select(
    selectLodesWorkplaceError,
  );
  protected readonly workplaceVisible$ = this.store.select(
    selectWorkplaceVisible,
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
        // Research coverage has an accessible semantic surface even if WebGL is unavailable.
        // The selected Census boundary is therefore the initial bounded viewport; once MapLibre
        // is ready, moveend replaces it with the actual interactive viewport.
        this.researchCoverageRequestFingerprint = '';
        this.scheduleResearchCoverageRefresh(0);
      });

    this.lodesFlowOverlay$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((overlay) => {
        this.pendingLodesFlowOverlay = overlay;
        this.renderLodesSampleLayer();
      });

    this.lodesWorkplaceOverlay$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((overlay) => {
        this.pendingLodesWorkplaceOverlay = overlay;
        this.renderWorkplaceLayer();
      });

    this.saipeChoropleth$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((choropleth) => {
        this.pendingSaipeChoropleth = choropleth;
        this.renderSaipeChoropleth();
      });

    this.populationEstimatesChoropleth$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((choropleth) => {
        this.pendingPopulationEstimates = choropleth;
        this.renderPopulationEstimates();
      });

    combineLatest([
      this.populationEstimateMeasure$,
      this.populationEstimateYear$,
    ])
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(([measure, year]) => {
        this.populationEstimateMeasure = measure;
        this.populationEstimateYear = year;
      });

    this.researchCoverageSummary$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((summary) => {
        this.pendingResearchCoverage = summary;
        if (summary) {
          this.renderResearchCoverage();
        } else {
          this.clearResearchCoverageGeometry();
        }
      });

    this.selectedResearchCoverageId$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((sourceIdentifier) => {
        this.selectedResearchCoverageId = sourceIdentifier;
        this.renderResearchCoverageSelection();
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
      this.workplaceVisible$,
      this.hydrographyVisible$,
      this.saipeVisible$,
      this.populationVisible$,
      this.researchCoverageVisible$,
    ])
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(
        ([
          tigerVisible,
          earthquakeVisible,
          lodesVisible,
          workplaceVisible,
          hydrographyVisible,
          saipeVisible,
          populationVisible,
          researchCoverageVisible,
        ]) => {
          this.tigerVisible = tigerVisible;
          this.workplaceVisible = workplaceVisible;
          this.earthquakeVisible = earthquakeVisible;
          this.lodesVisible = lodesVisible;
          this.hydrographyVisible = hydrographyVisible;
          this.saipeVisible = saipeVisible;
          this.populationVisible = populationVisible;
          this.researchCoverageVisible = researchCoverageVisible;
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

  protected toggleWorkplaceLayer(visible: boolean): void {
    this.store.dispatch(MapsActions.workplaceLayerToggled({ visible }));
    this.updateMapUrl({ workplaceVisible: visible });
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

  protected togglePopulationLayer(visible: boolean): void {
    this.store.dispatch(MapsActions.populationLayerToggled({ visible }));
    this.updateMapUrl({ populationVisible: visible });
  }

  protected changePopulationMeasure(value: string): void {
    const measure = value as PopulationEstimateMeasure;
    const year =
      measure === 'POPULATION'
        ? this.populationEstimateYear
        : Math.max(2021, this.populationEstimateYear);

    this.store.dispatch(
      MapsActions.populationEstimatesConfigurationChanged({
        measure,
        year,
      }),
    );

    this.updateMapUrl({
      populationMeasure: measure,
      populationYear: year,
    });
  }

  protected changePopulationYear(value: string): void {
    const parsed = Number(value);
    if (!Number.isInteger(parsed)) {
      return;
    }

    const minimum =
      this.populationEstimateMeasure === 'POPULATION' ? 2020 : 2021;
    const year = Math.max(minimum, Math.min(2025, parsed));

    this.store.dispatch(
      MapsActions.populationEstimatesConfigurationChanged({
        measure: this.populationEstimateMeasure,
        year,
      }),
    );

    this.updateMapUrl({
      populationMeasure: this.populationEstimateMeasure,
      populationYear: year,
    });
  }

  protected toggleResearchCoverageLayer(visible: boolean): void {
    this.store.dispatch(MapsActions.researchCoverageLayerToggled({ visible }));
    this.updateMapUrl({ researchCoverageVisible: visible });
  }

  protected selectResearchCoverageFeature(sourceIdentifier: string): void {
    if (this.selectedResearchCoverageId === sourceIdentifier) {
      this.clearResearchCoverageSelection();
      return;
    }

    this.store.dispatch(
      MapsActions.researchCoverageFeatureSelected({ sourceIdentifier }),
    );
  }

  protected clearResearchCoverageSelection(): void {
    this.store.dispatch(MapsActions.researchCoverageSelectionCleared());
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

  private scheduleResearchCoverageRefresh(delay = 250): void {
    if (this.researchCoverageRefreshTimer !== null) {
      clearTimeout(this.researchCoverageRefreshTimer);
    }

    this.researchCoverageRefreshTimer = setTimeout(() => {
      this.researchCoverageRefreshTimer = null;
      this.requestResearchCoverageForCurrentViewport();
    }, delay);
  }

  private currentResearchViewport(): ResearchSpatialViewport | null {
    // A MapLibre instance can exist even when WebGL/style initialization failed. Until the style
    // is actually ready, preserve the accessible bounded fallback from the selected Census area.
    if (this.map && this.mapStyleReady) {
      const bounds = this.map.getBounds();
      return {
        west: this.normalizeLongitude(bounds.getWest()),
        south: Math.max(-90, Math.min(90, bounds.getSouth())),
        east: this.normalizeLongitude(bounds.getEast()),
        north: Math.max(-90, Math.min(90, bounds.getNorth())),
      };
    }

    if (this.pendingBoundary) {
      return {
        west: this.pendingBoundary.west,
        south: this.pendingBoundary.south,
        east: this.pendingBoundary.east,
        north: this.pendingBoundary.north,
      };
    }

    return null;
  }

  private normalizeLongitude(longitude: number): number {
    const normalized = ((((longitude + 180) % 360) + 360) % 360) - 180;
    return normalized === -180 && longitude > 0 ? 180 : normalized;
  }

  private requestResearchCoverageForCurrentViewport(): void {
    const viewport = this.currentResearchViewport();
    if (!viewport) {
      return;
    }

    const viewportKey = [
      viewport.west,
      viewport.south,
      viewport.east,
      viewport.north,
    ]
      .map((value) => value.toFixed(5))
      .join(',');
    const fingerprint =
      this.researchCoverageCriteriaFingerprint + '|' + viewportKey;
    if (fingerprint === this.researchCoverageRequestFingerprint) {
      return;
    }

    this.researchCoverageRequestFingerprint = fingerprint;
    this.store.dispatch(
      MapsActions.researchCoverageRequested({
        query: this.researchCoverageCriteria,
        viewport,
      }),
    );
  }

  private bindPanAreaSync(): void {
    if (!this.map) {
      return;
    }

    const onMoveEnd = (): void => {
      if (this.skipPanAreaSync) {
        this.skipPanAreaSync = false;
      } else {
        this.schedulePanAreaSync();
      }

      this.scheduleResearchCoverageRefresh();
    };

    const onZoomChanged = (): void => this.refreshHydrographyZoomHint();

    this.map.on('moveend', onMoveEnd);
    this.map.on('zoomend', onZoomChanged);
    onZoomChanged();
    this.scheduleResearchCoverageRefresh(0);
    this.destroyRef.onDestroy(() => {
      if (this.panAreaSyncTimer !== null) {
        clearTimeout(this.panAreaSyncTimer);
      }
      if (this.researchCoverageRefreshTimer !== null) {
        clearTimeout(this.researchCoverageRefreshTimer);
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
   * Research context carried in from Discovery.
   *
   * Unlike the original decorative query label, Maps now reuses the exact effective search
   * criteria for one bounded facet request. Solr/OpenSearch aggregate geography over the complete
   * result set; the browser never receives the matching result list just to draw coverage.
   */
  protected readonly workforceView = signal(false);
  protected readonly researchQuery = signal<string | null>(null);

  private bindResearchContext(): void {
    this.route.queryParamMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((params) => {
        this.workforceView.set(params.get('view') === 'workforce');
        const q = params.get('q')?.trim() ?? '';
        this.researchQuery.set(q || null);
        const programs = params
          .getAll('program')
          .map((value) => value.trim())
          .filter(Boolean);
        const publisher = params.get('publisher')?.trim() ?? '';
        const sourceSystem = params.get('sourceSystem')?.trim() ?? '';
        const geography = params.get('geography')?.trim() ?? '';
        const contentType = params.get('type')?.trim() ?? '';
        const vintageYearValue = Number(params.get('vintageYear'));
        const vintageYear =
          Number.isInteger(vintageYearValue) && vintageYearValue > 0
            ? vintageYearValue
            : null;

        const query: SearchQuery = {
          q,
          ...(programs.length ? { programs } : {}),
          ...(publisher ? { publisher } : {}),
          ...(sourceSystem
            ? { sourceSystem: sourceSystem as SourceSystem }
            : {}),
          ...(geography ? { geography } : {}),
          ...(contentType
            ? { contentType: contentType as ResearchObjectType }
            : {}),
          ...(vintageYear !== null ? { vintageYear } : {}),
        };

        this.researchCoverageCriteria = query;
        const fingerprint = JSON.stringify(query);
        if (fingerprint !== this.researchCoverageCriteriaFingerprint) {
          this.researchCoverageCriteriaFingerprint = fingerprint;
          this.researchCoverageRequestFingerprint = '';
          this.scheduleResearchCoverageRefresh(0);
        }
      });
  }

  /** Query parameters that reconstruct the effective Discovery search. */
  protected backToSearchParams(): Record<string, string | string[]> {
    const query = this.researchCoverageCriteria;
    return {
      ...(query.q ? { q: query.q } : {}),
      ...(query.programs?.length ? { program: [...query.programs] } : {}),
      ...(query.publisher ? { publisher: query.publisher } : {}),
      ...(query.sourceSystem ? { sourceSystem: query.sourceSystem } : {}),
      ...(query.geography ? { geography: query.geography } : {}),
      ...(query.contentType ? { type: query.contentType } : {}),
      ...(query.vintageYear !== undefined
        ? { vintageYear: String(query.vintageYear) }
        : {}),
    };
  }

  private bindUrlState(): void {
    this.route.queryParamMap
      .pipe(
        map((params) => ({
          area: params.get('area'),
          tigerVisible: this.toVisibleState(params.get('tiger')),
          earthquakeVisible: this.toVisibleState(params.get('earthquakes')),
          lodesVisible: this.toVisibleState(params.get('lodes')),
          workplaceVisible: this.toVisibleState(params.get('workplace')),
          hydrographyVisible: this.toVisibleState(params.get('hydrography')),
          saipeVisible: this.toVisibleState(params.get('saipe')),
          populationVisible: this.toVisibleState(params.get('population')),
          populationMeasure: this.toPopulationMeasure(
            params.get('populationMeasure'),
          ),
          populationYear: this.toPopulationYear(params.get('populationYear')),
          researchCoverageVisible: this.toVisibleState(params.get('research')),
          featureId: params.get('feature'),
        })),
        distinctUntilChanged(
          (previous, current) =>
            previous.area === current.area &&
            previous.tigerVisible === current.tigerVisible &&
            previous.earthquakeVisible === current.earthquakeVisible &&
            previous.lodesVisible === current.lodesVisible &&
            previous.workplaceVisible === current.workplaceVisible &&
            previous.hydrographyVisible === current.hydrographyVisible &&
            previous.saipeVisible === current.saipeVisible &&
            previous.populationVisible === current.populationVisible &&
            previous.populationMeasure === current.populationMeasure &&
            previous.populationYear === current.populationYear &&
            previous.researchCoverageVisible ===
              current.researchCoverageVisible &&
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
          workplaceVisible,
          hydrographyVisible,
          saipeVisible,
          populationVisible,
          populationMeasure,
          populationYear,
          researchCoverageVisible,
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

          if (workplaceVisible !== null) {
            this.store.dispatch(
              MapsActions.workplaceLayerToggled({ visible: workplaceVisible }),
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

          if (populationVisible !== null) {
            this.store.dispatch(
              MapsActions.populationLayerToggled({
                visible: populationVisible,
              }),
            );
          }

          if (populationMeasure !== null || populationYear !== null) {
            const measure = populationMeasure ?? this.populationEstimateMeasure;
            const requestedYear = populationYear ?? this.populationEstimateYear;
            const year =
              measure === 'POPULATION'
                ? requestedYear
                : Math.max(2021, requestedYear);

            this.store.dispatch(
              MapsActions.populationEstimatesConfigurationChanged({
                measure,
                year,
              }),
            );
          }

          if (researchCoverageVisible !== null) {
            this.store.dispatch(
              MapsActions.researchCoverageLayerToggled({
                visible: researchCoverageVisible,
              }),
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
    workplaceVisible?: boolean;
    hydrographyVisible?: boolean;
    saipeVisible?: boolean;
    populationVisible?: boolean;
    populationMeasure?: PopulationEstimateMeasure;
    populationYear?: number;
    researchCoverageVisible?: boolean;
    featureId?: string | null;
  }): void {
    const queryParams: Record<string, string | number | null> = {};

    if (options.geography !== undefined) {
      queryParams['area'] = options.geography;
    }

    if (options.tigerVisible !== undefined) {
      queryParams['tiger'] = this.toLayerParam(options.tigerVisible);
    }

    if (options.featureId !== undefined) {
      queryParams['feature'] = options.featureId ?? null;
    }

    if (options.earthquakeVisible !== undefined) {
      queryParams['earthquakes'] = this.toLayerParam(options.earthquakeVisible);
    }

    if (options.lodesVisible !== undefined) {
      queryParams['lodes'] = this.toLayerParam(options.lodesVisible);
    }

    if (options.workplaceVisible !== undefined) {
      queryParams['workplace'] = this.toLayerParam(options.workplaceVisible);
    }

    if (options.hydrographyVisible !== undefined) {
      queryParams['hydrography'] = this.toLayerParam(
        options.hydrographyVisible,
      );
    }

    if (options.saipeVisible !== undefined) {
      queryParams['saipe'] = this.toLayerParam(options.saipeVisible);
    }

    if (options.populationVisible !== undefined) {
      queryParams['population'] = options.populationVisible ? 'on' : 'off';
    }

    if (options.populationMeasure !== undefined) {
      queryParams['populationMeasure'] = options.populationMeasure;
    }

    if (options.populationYear !== undefined) {
      queryParams['populationYear'] = options.populationYear;
    }

    if (options.researchCoverageVisible !== undefined) {
      queryParams['research'] = options.researchCoverageVisible ? 'on' : 'off';
    }

    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams,
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

  private toPopulationMeasure(
    value: string | null,
  ): PopulationEstimateMeasure | null {
    if (
      value === 'POPULATION' ||
      value === 'ANNUAL_CHANGE' ||
      value === 'ANNUAL_GROWTH_RATE'
    ) {
      return value;
    }

    return null;
  }

  private toPopulationYear(value: string | null): number | null {
    const parsed = Number(value);

    return Number.isInteger(parsed) && parsed >= 2020 && parsed <= 2025
      ? parsed
      : null;
  }

  private isOverlayStale(staleAfter: string): boolean {
    const staleAfterTime = new Date(staleAfter).getTime();

    if (Number.isNaN(staleAfterTime)) {
      return true;
    }

    return Date.now() > staleAfterTime;
  }

  private focusResearchCoverageButton(sourceIdentifier: string): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    setTimeout(() => {
      document
        .getElementById(`research-coverage-feature-${sourceIdentifier}`)
        ?.focus();
    });
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

    this.map.on(
      'click',
      'repository-research-coverage-clusters',
      async (event) => {
        if (!this.map) {
          return;
        }

        await expandResearchCoverageCluster(this.map, event.features?.[0]);
      },
    );

    this.map.on('mouseenter', 'repository-research-coverage-clusters', () => {
      if (this.map) {
        this.map.getCanvas().style.cursor = 'pointer';
      }
    });

    this.map.on('mouseleave', 'repository-research-coverage-clusters', () => {
      if (this.map) {
        this.map.getCanvas().style.cursor = '';
      }
    });

    this.map.on('click', 'repository-research-coverage-points', (event) => {
      const sourceIdentifier =
        event.features?.[0]?.properties?.['sourceIdentifier'];

      if (typeof sourceIdentifier !== 'string') {
        return;
      }

      this.selectResearchCoverageFeature(sourceIdentifier);
      this.focusResearchCoverageButton(sourceIdentifier);
    });

    this.map.on('mouseenter', 'repository-research-coverage-points', () => {
      if (this.map) {
        this.map.getCanvas().style.cursor = 'pointer';
      }
    });

    this.map.on('mouseleave', 'repository-research-coverage-points', () => {
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
    this.renderWorkplaceLayer();
    this.renderSaipeChoropleth();
    this.renderPopulationEstimates();
    this.renderResearchCoverage();
    this.renderResearchCoverageSelection();
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

  /**
   * Workplace employment as proportional circles.
   *
   * <p>Radius is interpolated on the square root of the job count, not on the count itself. A
   * circle is read by its area, and area grows with the square of the radius: scaling radius
   * linearly would draw Cass County's 131,603 jobs as something like five times the visual weight
   * it should carry against Burleigh's 59,122. Square-rooting first makes area proportional to the
   * value, which is what the eye is actually measuring.
   *
   * <p>The upper bound comes from the overlay's own `maxJobCount` rather than from a constant, so
   * a state whose largest county holds 20,000 jobs uses the same visual range as one holding
   * 130,000. The circles compare counties within an area; they are not a national scale.
   */
  private renderWorkplaceLayer(): void {
    if (
      !this.map ||
      !this.mapStyleReady ||
      !this.pendingLodesWorkplaceOverlay
    ) {
      return;
    }

    const overlay = this.pendingLodesWorkplaceOverlay;
    const data = overlay.geoJson as GeoJsonFeatureCollection;
    const existingSource = this.map.getSource(
      'lodes-workplace-jobs',
    ) as GeoJSONSource | null;

    if (existingSource) {
      existingSource.setData(data);
      this.applyWorkplaceRadius(overlay.maxJobCount);
      this.applyLayerVisibility();
      return;
    }

    this.map.addSource('lodes-workplace-jobs', { type: 'geojson', data });

    this.map.addLayer({
      id: 'lodes-workplace-jobs-circles',
      type: 'circle',
      source: 'lodes-workplace-jobs',
      layout: {
        visibility: this.workplaceVisible ? 'visible' : 'none',
      },
      paint: {
        'circle-color': '#0ea5e9',
        // Semi-transparent so overlapping counties stay readable and the commuting lines
        // underneath are not hidden by the layer that explains them.
        'circle-opacity': 0.55,
        'circle-stroke-color': '#ffffff',
        'circle-stroke-width': 1.5,
        'circle-radius': this.workplaceRadiusExpression(overlay.maxJobCount),
      },
    });

    this.applyLayerVisibility();
  }

  private applyWorkplaceRadius(maxJobCount: number): void {
    if (!this.map?.getLayer('lodes-workplace-jobs-circles')) {
      return;
    }

    this.map.setPaintProperty(
      'lodes-workplace-jobs-circles',
      'circle-radius',
      this.workplaceRadiusExpression(maxJobCount),
    );
  }

  /** Area-proportional radius: interpolate linearly on sqrt(jobs), never on jobs. */
  private workplaceRadiusExpression(
    maxJobCount: number,
  ): DataDrivenPropertyValueSpecification<number> {
    // A floor of 1 keeps the expression valid for an area whose counties all report zero jobs.
    const largest = Math.sqrt(Math.max(1, maxJobCount));

    return [
      'interpolate',
      ['linear'],
      ['sqrt', ['to-number', ['get', 'jobs']]],
      0,
      3,
      largest,
      30,
    ] as DataDrivenPropertyValueSpecification<number>;
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

  private renderPopulationEstimates(): void {
    if (!this.map || !this.mapStyleReady || !this.pendingPopulationEstimates) {
      return;
    }

    const overlay = this.pendingPopulationEstimates;
    const data = overlay.geoJson as GeoJsonFeatureCollection;
    const scale = buildPopulationEstimateScale(overlay);

    const existingSource = this.map.getSource(
      'population-estimates-county',
    ) as GeoJSONSource | null;

    if (existingSource) {
      existingSource.setData(data);

      if (this.map.getLayer('population-estimates-county-fill')) {
        this.map.setPaintProperty(
          'population-estimates-county-fill',
          'fill-color',
          scale.fillColor,
        );
      }

      this.applyLayerVisibility();
      return;
    }

    this.map.addSource('population-estimates-county', {
      type: 'geojson',
      data,
    });

    this.map.addLayer(
      {
        id: 'population-estimates-county-fill',
        type: 'fill',
        source: 'population-estimates-county',
        layout: {
          visibility: this.populationVisible ? 'visible' : 'none',
        },
        paint: {
          'fill-color': scale.fillColor,
          'fill-opacity': 0.72,
        },
      },
      'census-area-fill',
    );

    this.map.addLayer({
      id: 'population-estimates-county-outline',
      type: 'line',
      source: 'population-estimates-county',
      layout: {
        visibility: this.populationVisible ? 'visible' : 'none',
      },
      paint: {
        'line-color': '#334155',
        'line-width': 1.25,
      },
    });

    this.applyLayerVisibility();
  }

  /**
   * Draws the current viewport's bounded publisher spatial evidence.
   *
   * Ordinary rows use the publisher GeoJSON retained by the versioned sidecar. Antimeridian
   * candidates use the explicit source-derived render anchor instead of drawing a naive envelope
   * across the world. The semantic table exposes the same bounded feature list and rendering mode.
   */
  private renderResearchCoverage(): void {
    if (!this.map || !this.mapStyleReady || !this.pendingResearchCoverage) {
      return;
    }

    const data = this.createResearchCoverageGeoJson(
      this.pendingResearchCoverage,
    );
    const existingSource = this.map.getSource(
      'repository-research-coverage',
    ) as GeoJSONSource | null;

    if (existingSource) {
      existingSource.setData(data);
      this.applyLayerVisibility();
      return;
    }

    this.map.addSource('repository-research-coverage', {
      type: 'geojson',
      data,
      cluster: true,
      clusterMaxZoom: 7,
      clusterRadius: 45,
    });

    this.map.addLayer({
      id: 'repository-research-coverage-clusters',
      type: 'circle',
      source: 'repository-research-coverage',
      filter: ['has', 'point_count'],
      layout: {
        visibility: this.researchCoverageVisible ? 'visible' : 'none',
      },
      paint: {
        'circle-color': '#0f766e',
        'circle-opacity': 0.78,
        'circle-stroke-color': '#ffffff',
        'circle-stroke-width': 2,
        'circle-radius': [
          'step',
          ['get', 'point_count'],
          17,
          10,
          21,
          50,
          26,
          100,
          31,
        ],
      },
    });

    this.map.addLayer({
      id: 'repository-research-coverage-cluster-count',
      type: 'symbol',
      source: 'repository-research-coverage',
      filter: ['has', 'point_count'],
      layout: {
        visibility: this.researchCoverageVisible ? 'visible' : 'none',
        'text-field': ['get', 'point_count_abbreviated'],
        'text-size': 12,
      },
      paint: {
        'text-color': '#ffffff',
      },
    });

    this.map.addLayer({
      id: 'repository-research-coverage-points',
      type: 'circle',
      source: 'repository-research-coverage',
      filter: ['!', ['has', 'point_count']],
      layout: {
        visibility: this.researchCoverageVisible ? 'visible' : 'none',
      },
      paint: {
        'circle-color': '#0f766e',
        'circle-opacity': 0.74,
        'circle-radius': 6,
        'circle-stroke-color': '#ffffff',
        'circle-stroke-width': 1.5,
      },
    });

    this.applyLayerVisibility();
    this.renderResearchCoverageSelection();
  }

  private renderResearchCoverageSelection(): void {
    if (!this.map || !this.mapStyleReady) {
      return;
    }

    const data = this.createResearchCoverageSelectionGeoJson();
    const existingSource = this.map.getSource(
      'repository-research-coverage-selection',
    ) as GeoJSONSource | null;

    if (existingSource) {
      existingSource.setData(data);
      this.applyLayerVisibility();
      return;
    }

    this.map.addSource('repository-research-coverage-selection', {
      type: 'geojson',
      data,
    });

    this.map.addLayer({
      id: 'repository-research-coverage-selected-fill',
      type: 'fill',
      source: 'repository-research-coverage-selection',
      filter: ['==', ['get', 'selectionGeometry'], 'FOOTPRINT'],
      layout: {
        visibility: this.researchCoverageVisible ? 'visible' : 'none',
      },
      paint: {
        'fill-color': '#0f766e',
        'fill-opacity': 0.11,
      },
    });

    this.map.addLayer({
      id: 'repository-research-coverage-selected-line',
      type: 'line',
      source: 'repository-research-coverage-selection',
      filter: ['==', ['get', 'selectionGeometry'], 'FOOTPRINT'],
      layout: {
        visibility: this.researchCoverageVisible ? 'visible' : 'none',
      },
      paint: {
        'line-color': '#115e59',
        'line-width': 3,
        'line-opacity': 0.95,
      },
    });

    this.map.addLayer({
      id: 'repository-research-coverage-selected-anchor',
      type: 'circle',
      source: 'repository-research-coverage-selection',
      filter: ['==', ['get', 'selectionGeometry'], 'ANCHOR'],
      layout: {
        visibility: this.researchCoverageVisible ? 'visible' : 'none',
      },
      paint: {
        'circle-color': '#ffffff',
        'circle-radius': 10,
        'circle-stroke-color': '#115e59',
        'circle-stroke-width': 4,
      },
    });

    this.applyLayerVisibility();
  }

  private createResearchCoverageSelectionGeoJson(): GeoJsonFeatureCollection {
    const selected =
      this.pendingResearchCoverage?.features.find(
        (feature) =>
          feature.sourceIdentifier === this.selectedResearchCoverageId,
      ) ?? null;

    if (!selected) {
      return { type: 'FeatureCollection', features: [] };
    }

    const features: unknown[] = [];

    const anchor = this.researchCoverageRenderAnchor(selected);
    if (anchor) {
      features.push({
        type: 'Feature',
        properties: {
          sourceIdentifier: selected.sourceIdentifier,
          selectionGeometry: 'ANCHOR',
        },
        geometry: anchor,
      });
    }

    // Antimeridian candidates remain anchor-only. Their naive polygon could
    // paint across the world and undo the safety contract this workstream
    // established.
    if (
      selected.geometryStatus === 'VALID' &&
      selected.geometry &&
      selected.geometry['type'] !== 'Point'
    ) {
      features.push({
        type: 'Feature',
        properties: {
          sourceIdentifier: selected.sourceIdentifier,
          selectionGeometry: 'FOOTPRINT',
        },
        geometry: selected.geometry,
      });
    }

    return {
      type: 'FeatureCollection',
      features,
    };
  }

  private clearResearchCoverageGeometry(): void {
    if (!this.map || !this.mapStyleReady) {
      return;
    }

    const source = this.map.getSource(
      'repository-research-coverage',
    ) as GeoJSONSource | null;
    source?.setData({ type: 'FeatureCollection', features: [] });

    const selectionSource = this.map.getSource(
      'repository-research-coverage-selection',
    ) as GeoJSONSource | null;
    selectionSource?.setData({
      type: 'FeatureCollection',
      features: [],
    });
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

  private createResearchCoverageGeoJson(
    summary: ResearchCoverageSummary,
  ): ResearchCoverageFeatureCollection {
    return {
      type: 'FeatureCollection',
      features: summary.features.flatMap((feature) => {
        const geometry = this.researchCoverageRenderAnchor(feature);
        if (!geometry) {
          return [];
        }

        return [
          {
            type: 'Feature' as const,
            properties: {
              sourceIdentifier: feature.sourceIdentifier,
              title: feature.title,
              publisher: feature.publisher ?? null,
              program: feature.program ?? null,
              contentType: feature.contentType ?? null,
              sourceUrl: feature.sourceUrl ?? null,
              geometryStatus: feature.geometryStatus,
              renderPointMethod: feature.renderPointMethod ?? null,
              mapRendering:
                feature.geometryStatus === 'ANTIMERIDIAN_CANDIDATE'
                  ? ('ANTIMERIDIAN_ANCHOR' as const)
                  : ('RENDER_ANCHOR' as const),
            },
            geometry,
          },
        ];
      }),
    };
  }

  private researchCoverageRenderAnchor(
    feature: ResearchSpatialCoverageFeature,
  ): {
    type: 'Point';
    coordinates: [number, number];
  } | null {
    if (
      feature.renderLon === null ||
      feature.renderLon === undefined ||
      feature.renderLat === null ||
      feature.renderLat === undefined ||
      !Number.isFinite(feature.renderLon) ||
      !Number.isFinite(feature.renderLat)
    ) {
      return null;
    }

    return {
      type: 'Point',
      coordinates: [feature.renderLon, feature.renderLat],
    };
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
      workplace: this.workplaceVisible,
      saipe: this.saipeVisible,
      population: this.populationVisible,
      research: this.researchCoverageVisible,
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
