import { isPlatformBrowser } from '@angular/common';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  Input,
  OnChanges,
  OnDestroy,
  PLATFORM_ID,
  signal,
  SimpleChanges,
  ViewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Params } from '@angular/router';
import type {
  GeoJSONSource,
  Map as MapLibreMap,
  MapLayerMouseEvent,
  StyleSpecification,
} from 'maplibre-gl';
import {
  parseRepositoryError,
  RepositoryMapsApi,
  type CensusAreaBoundary,
  type ResearchSpatialCoverageFeature,
  type ResearchSpatialCoverageResponse,
  type ResearchSpatialViewport,
  type SearchQuery,
} from 'repository-api-client';
import {
  catchError,
  defer,
  map,
  of,
  ReplaySubject,
  shareReplay,
  startWith,
  switchMap,
} from 'rxjs';
import { SearchRouteQueryAdapter } from '../state/search/search-route-query.adapter';

const INITIAL_VIEWPORT: ResearchSpatialViewport = {
  west: -180,
  south: -85,
  east: 180,
  north: 85,
};

type CoverageRequest = {
  readonly query: SearchQuery;
  readonly viewport: ResearchSpatialViewport;
};

type CoverageState =
  | { readonly status: 'loading' }
  | {
      readonly status: 'loaded';
      readonly response: ResearchSpatialCoverageResponse;
    }
  | { readonly status: 'error'; readonly message: string };

type CensusAreaState =
  | { readonly status: 'loading' }
  | { readonly status: 'loaded'; readonly boundaries: CensusAreaBoundary[] }
  | { readonly status: 'error'; readonly message: string };

type CoverageFeatureCollection = {
  readonly type: 'FeatureCollection';
  readonly features: readonly {
    readonly type: 'Feature';
    readonly id: string;
    readonly properties: Readonly<Record<string, string | null>>;
    readonly geometry: Readonly<Record<string, unknown>>;
  }[];
};

type AreaContextFeatureCollection = {
  readonly type: 'FeatureCollection';
  readonly features: readonly {
    readonly type: 'Feature';
    readonly properties: {
      readonly id: string;
      readonly geography: string;
      readonly semantics: 'ORIENTATION_EXTENT_ONLY';
    };
    readonly geometry: {
      readonly type: 'Polygon';
      readonly coordinates: readonly (readonly [number, number])[][];
    };
  }[];
};

type MobileMapPreset = 'research' | 'research-area-context';

@Component({
  selector: 'app-mobile-research-map-preview',
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './mobile-research-map-preview.component.html',
  styleUrl: './mobile-research-map-preview.component.scss',
})
export class MobileResearchMapPreviewComponent
  implements OnChanges, AfterViewInit, OnDestroy
{
  private readonly mapsApi = inject(RepositoryMapsApi);
  private readonly routeQueryAdapter = inject(SearchRouteQueryAdapter);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly destroyRef = inject(DestroyRef);
  private readonly requests = new ReplaySubject<CoverageRequest>(1);

  @Input() query: SearchQuery = {};
  @Input() interactive = false;
  @Input() expanded = false;

  @ViewChild('mapCanvas')
  private readonly mapCanvas?: ElementRef<HTMLDivElement>;

  protected queryParams: Params = {};
  protected readonly mapUnavailable = signal(false);
  protected readonly mapInitialized = signal(false);
  protected readonly mapPreset = signal<MobileMapPreset>('research');
  protected readonly selectedCensusArea = signal<CensusAreaBoundary | null>(
    null,
  );
  protected readonly selectedSourceIdentifier = signal<string | null>(null);
  protected readonly visibleResearchFeatures = signal<
    readonly ResearchSpatialCoverageFeature[]
  >([]);
  protected readonly selectedResearch = computed(() => {
    const selectedSourceIdentifier = this.selectedSourceIdentifier();
    if (!selectedSourceIdentifier) {
      return null;
    }
    return (
      this.visibleResearchFeatures().find(
        (feature) => feature.sourceIdentifier === selectedSourceIdentifier,
      ) ?? null
    );
  });
  protected readonly state$ = this.requests.pipe(
    switchMap(({ query, viewport }) =>
      this.mapsApi
        .getResearchSpatialCoverage(
          query,
          viewport,
          this.interactive ? 200 : 80,
        )
        .pipe(
          map(
            (response): CoverageState => ({
              status: 'loaded',
              response,
            }),
          ),
          startWith<CoverageState>({ status: 'loading' }),
          catchError((error: unknown) =>
            of<CoverageState>({
              status: 'error',
              message: parseRepositoryError(
                error,
                'Research coverage could not be loaded.',
              ).message,
            }),
          ),
        ),
    ),
    shareReplay({ bufferSize: 1, refCount: true }),
  );
  protected readonly censusAreaState$ = defer(() =>
    this.mapsApi.listCensusAreaBoundaries(),
  ).pipe(
    map(
      (boundaries): CensusAreaState => ({
        status: 'loaded',
        boundaries,
      }),
    ),
    startWith<CensusAreaState>({ status: 'loading' }),
    catchError((error: unknown) =>
      of<CensusAreaState>({
        status: 'error',
        message: parseRepositoryError(
          error,
          'Census area context could not be loaded.',
        ).message,
      }),
    ),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  private map: MapLibreMap | null = null;
  private mapModule: typeof import('maplibre-gl') | null = null;
  private styleReady = false;
  private pendingResponse: ResearchSpatialCoverageResponse | null = null;
  private currentViewport = INITIAL_VIEWPORT;
  private initialFitPending = true;
  private censusAreas: readonly CensusAreaBoundary[] = [];
  private censusAreasConnected = false;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['query'] || changes['interactive']) {
      this.queryParams = this.routeQueryAdapter.toQueryParams(this.query);
      this.currentViewport = INITIAL_VIEWPORT;
      this.initialFitPending = true;
      if (changes['query']) {
        this.selectResearchFeature(null);
      }
      this.requests.next({
        query: this.query,
        viewport: this.currentViewport,
      });
      this.applyQueryGeographyContext();
    }

    if (this.expanded) {
      this.connectCensusAreas();
    }
  }

  ngAfterViewInit(): void {
    this.state$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((state) => {
      if (state.status === 'loaded') {
        void this.renderCoverage(state.response);
      }
    });
  }

  ngOnDestroy(): void {
    this.map?.remove();
    this.map = null;
  }

  protected sourceLabel(response: ResearchSpatialCoverageResponse): string {
    return response.sourceSystem === 'DATA_GOV'
      ? 'Data.gov'
      : response.sourceSystem;
  }

  protected hasCompatibilityBoundary(): boolean {
    return Boolean(this.query.geography || this.query.vintageYear);
  }

  protected isResearchSelected(
    feature: ResearchSpatialCoverageFeature,
  ): boolean {
    return this.selectedSourceIdentifier() === feature.sourceIdentifier;
  }

  protected selectResearchFeature(sourceIdentifier: string | null): void {
    if (
      sourceIdentifier &&
      !this.visibleResearchFeatures().some(
        (feature) => feature.sourceIdentifier === sourceIdentifier,
      )
    ) {
      return;
    }

    const previousSourceIdentifier = this.selectedSourceIdentifier();
    if (previousSourceIdentifier === sourceIdentifier) {
      return;
    }

    this.selectedSourceIdentifier.set(sourceIdentifier);
    this.updateResearchSelectionFeatureState(
      previousSourceIdentifier,
      sourceIdentifier,
    );
  }

  protected selectMapPreset(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    const preset: MobileMapPreset =
      value === 'research-area-context' ? 'research-area-context' : 'research';
    this.mapPreset.set(preset);

    if (preset === 'research') {
      this.selectedCensusArea.set(null);
      this.renderCensusAreaContext(null);
      if (this.pendingResponse) {
        this.fitCoverage(this.pendingResponse);
      }
      return;
    }

    const queryMatch = this.findCensusArea(this.query.geography);
    if (queryMatch && !this.selectedCensusArea()) {
      this.selectArea(queryMatch);
    }
  }

  protected selectCensusArea(event: Event): void {
    const id = (event.target as HTMLSelectElement).value;
    const boundary = this.censusAreas.find((candidate) => candidate.id === id);
    if (!boundary) {
      this.selectedCensusArea.set(null);
      this.renderCensusAreaContext(null);
      return;
    }

    this.mapPreset.set('research-area-context');
    this.selectArea(boundary);
  }

  private connectCensusAreas(): void {
    if (this.censusAreasConnected) {
      return;
    }
    this.censusAreasConnected = true;

    this.censusAreaState$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((state) => {
        if (state.status !== 'loaded') {
          return;
        }
        this.censusAreas = state.boundaries;
        this.applyQueryGeographyContext();
      });
  }

  private applyQueryGeographyContext(): void {
    if (!this.expanded || this.censusAreas.length === 0) {
      return;
    }
    const boundary = this.findCensusArea(this.query.geography);
    if (!boundary) {
      return;
    }
    this.mapPreset.set('research-area-context');
    this.selectArea(boundary);
  }

  private findCensusArea(
    geography: string | undefined,
  ): CensusAreaBoundary | null {
    const normalized = geography?.trim().toLocaleLowerCase();
    if (!normalized) {
      return null;
    }
    return (
      this.censusAreas.find(
        (boundary) => boundary.geography.toLocaleLowerCase() === normalized,
      ) ?? null
    );
  }

  private selectArea(boundary: CensusAreaBoundary): void {
    this.selectedCensusArea.set(boundary);
    this.renderCensusAreaContext(boundary);
    this.fitCensusArea(boundary);
  }

  private async renderCoverage(
    response: ResearchSpatialCoverageResponse,
  ): Promise<void> {
    this.pendingResponse = response;
    this.visibleResearchFeatures.set(response.features);
    this.reconcileResearchSelection(response);

    const map = await this.ensureMap();
    if (!map || !this.styleReady) {
      return;
    }

    this.renderCensusAreaContext(this.selectedCensusArea());
    this.updateCoverageSource(response);
    if (!this.interactive || this.initialFitPending) {
      const selectedArea = this.selectedCensusArea();
      if (selectedArea && this.mapPreset() === 'research-area-context') {
        this.fitCensusArea(selectedArea);
      } else {
        this.fitCoverage(response);
      }
      this.initialFitPending = false;
    }
  }

  private reconcileResearchSelection(
    response: ResearchSpatialCoverageResponse,
  ): void {
    const selectedSourceIdentifier = this.selectedSourceIdentifier();
    if (
      selectedSourceIdentifier &&
      !response.features.some(
        (feature) => feature.sourceIdentifier === selectedSourceIdentifier,
      )
    ) {
      this.selectResearchFeature(null);
    }
  }

  private async ensureMap(): Promise<MapLibreMap | null> {
    if (this.map) {
      return this.map;
    }
    if (
      !isPlatformBrowser(this.platformId) ||
      !this.mapCanvas ||
      typeof WebGLRenderingContext === 'undefined'
    ) {
      this.mapUnavailable.set(true);
      return null;
    }

    try {
      const maplibregl = await import('maplibre-gl');
      maplibregl.setWorkerUrl('/maplibre-gl-worker.mjs');
      this.mapModule = maplibregl;
      const map = new maplibregl.Map({
        container: this.mapCanvas.nativeElement,
        style: this.baseStyle(),
        center: [-98.5, 39.5],
        zoom: 2.15,
        minZoom: 1,
        maxZoom: 12,
        interactive: this.interactive,
        attributionControl: false,
        dragRotate: false,
        pitchWithRotate: false,
      });

      if (this.interactive) {
        map.addControl(
          new maplibregl.NavigationControl({ showCompass: false }),
          'top-right',
        );
        map.on('moveend', () => this.requestCurrentViewport());
      }

      map.once('style.load', () => {
        this.styleReady = true;
        this.renderCensusAreaContext(this.selectedCensusArea());
        if (this.pendingResponse) {
          this.updateCoverageSource(this.pendingResponse);
          if (!this.interactive || this.initialFitPending) {
            const selectedArea = this.selectedCensusArea();
            if (selectedArea && this.mapPreset() === 'research-area-context') {
              this.fitCensusArea(selectedArea);
            } else {
              this.fitCoverage(this.pendingResponse);
            }
            this.initialFitPending = false;
          }
        }
      });

      this.map = map;
      this.mapInitialized.set(true);
      return map;
    } catch {
      this.mapUnavailable.set(true);
      return null;
    }
  }

  private baseStyle(): StyleSpecification {
    return {
      version: 8,
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
          id: 'osm-reference',
          type: 'raster',
          source: 'osm',
          paint: { 'raster-opacity': 0.7 },
        },
      ],
    };
  }

  private renderCensusAreaContext(boundary: CensusAreaBoundary | null): void {
    const map = this.map;
    if (!map || !this.styleReady) {
      return;
    }

    const source = map.getSource('mobile-census-area-context') as
      | GeoJSONSource
      | undefined;
    const data = this.areaContextFeatureCollection(boundary);

    if (source) {
      source.setData(
        data as unknown as Parameters<GeoJSONSource['setData']>[0],
      );
      if (map.getLayer('mobile-census-area-context-line')) {
        map.setLayoutProperty(
          'mobile-census-area-context-line',
          'visibility',
          boundary && this.mapPreset() === 'research-area-context'
            ? 'visible'
            : 'none',
        );
      }
      return;
    }

    map.addSource('mobile-census-area-context', {
      type: 'geojson',
      data: data as never,
    });
    map.addLayer({
      id: 'mobile-census-area-context-line',
      type: 'line',
      source: 'mobile-census-area-context',
      layout: {
        visibility:
          boundary && this.mapPreset() === 'research-area-context'
            ? 'visible'
            : 'none',
      },
      paint: {
        'line-color': '#6d28d9',
        'line-width': 2.5,
        'line-dasharray': [2, 2],
      },
    });
  }

  private areaContextFeatureCollection(
    boundary: CensusAreaBoundary | null,
  ): AreaContextFeatureCollection {
    if (!boundary) {
      return { type: 'FeatureCollection', features: [] };
    }

    return {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: {
            id: boundary.id,
            geography: boundary.geography,
            semantics: 'ORIENTATION_EXTENT_ONLY',
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

  private updateCoverageSource(
    response: ResearchSpatialCoverageResponse,
  ): void {
    const map = this.map;
    if (!map || !this.styleReady) {
      return;
    }

    const data = this.featureCollection(response);
    const existing = map.getSource('mobile-research-coverage') as
      | GeoJSONSource
      | undefined;
    if (existing) {
      existing.setData(
        data as unknown as Parameters<GeoJSONSource['setData']>[0],
      );
      this.applyResearchSelectionFeatureState();
      return;
    }

    map.addSource('mobile-research-coverage', {
      type: 'geojson',
      data: data as never,
    });
    map.addLayer({
      id: 'mobile-research-coverage-fill',
      type: 'fill',
      source: 'mobile-research-coverage',
      filter: ['==', ['geometry-type'], 'Polygon'],
      paint: {
        'fill-color': '#0f766e',
        'fill-opacity': [
          'case',
          ['boolean', ['feature-state', 'selected'], false],
          0.52,
          0.26,
        ],
      },
    });
    map.addLayer({
      id: 'mobile-research-coverage-line',
      type: 'line',
      source: 'mobile-research-coverage',
      filter: ['==', ['geometry-type'], 'Polygon'],
      paint: {
        'line-color': '#115e59',
        'line-width': [
          'case',
          ['boolean', ['feature-state', 'selected'], false],
          4,
          2,
        ],
      },
    });
    map.addLayer({
      id: 'mobile-research-coverage-point',
      type: 'circle',
      source: 'mobile-research-coverage',
      filter: ['==', ['geometry-type'], 'Point'],
      paint: {
        'circle-color': '#0f766e',
        'circle-radius': [
          'case',
          ['boolean', ['feature-state', 'selected'], false],
          this.expanded ? 9 : 6,
          this.expanded ? 6 : 4,
        ],
        'circle-stroke-color': '#ffffff',
        'circle-stroke-width': [
          'case',
          ['boolean', ['feature-state', 'selected'], false],
          3,
          1.5,
        ],
      },
    });

    this.bindCoverageSelectionHandlers(map);
    this.applyResearchSelectionFeatureState();
  }

  private bindCoverageSelectionHandlers(map: MapLibreMap): void {
    if (!this.expanded || !this.interactive) {
      return;
    }

    const selectFeature = (event: MapLayerMouseEvent): void => {
      const sourceIdentifier =
        event.features?.[0]?.properties?.['sourceIdentifier'];
      if (typeof sourceIdentifier === 'string') {
        this.selectResearchFeature(sourceIdentifier);
      }
    };

    map.on('click', 'mobile-research-coverage-fill', selectFeature);
    map.on('click', 'mobile-research-coverage-point', selectFeature);
    map.on('mouseenter', 'mobile-research-coverage-fill', () => {
      map.getCanvas().style.cursor = 'pointer';
    });
    map.on('mouseenter', 'mobile-research-coverage-point', () => {
      map.getCanvas().style.cursor = 'pointer';
    });
    map.on('mouseleave', 'mobile-research-coverage-fill', () => {
      map.getCanvas().style.cursor = '';
    });
    map.on('mouseleave', 'mobile-research-coverage-point', () => {
      map.getCanvas().style.cursor = '';
    });
  }

  private updateResearchSelectionFeatureState(
    previousSourceIdentifier: string | null,
    sourceIdentifier: string | null,
  ): void {
    const map = this.map;
    if (
      !map ||
      !this.styleReady ||
      !map.getSource('mobile-research-coverage')
    ) {
      return;
    }

    if (previousSourceIdentifier) {
      map.setFeatureState(
        {
          source: 'mobile-research-coverage',
          id: previousSourceIdentifier,
        },
        { selected: false },
      );
    }
    if (sourceIdentifier) {
      map.setFeatureState(
        { source: 'mobile-research-coverage', id: sourceIdentifier },
        { selected: true },
      );
    }
  }

  private applyResearchSelectionFeatureState(): void {
    const sourceIdentifier = this.selectedSourceIdentifier();
    if (!sourceIdentifier) {
      return;
    }
    this.updateResearchSelectionFeatureState(null, sourceIdentifier);
  }

  private featureCollection(
    response: ResearchSpatialCoverageResponse,
  ): CoverageFeatureCollection {
    return {
      type: 'FeatureCollection',
      features: response.features.flatMap((feature) => {
        const geometry = this.renderGeometry(feature);
        if (!geometry) {
          return [];
        }
        return [
          {
            type: 'Feature' as const,
            id: feature.sourceIdentifier,
            properties: {
              sourceIdentifier: feature.sourceIdentifier,
              title: feature.title,
              publisher: feature.publisher ?? null,
              program: feature.program ?? null,
              contentType: feature.contentType ?? null,
            },
            geometry,
          },
        ];
      }),
    };
  }

  private renderGeometry(
    feature: ResearchSpatialCoverageFeature,
  ): Readonly<Record<string, unknown>> | null {
    if (
      feature.geometryStatus === 'ANTIMERIDIAN_CANDIDATE' &&
      typeof feature.renderLon === 'number' &&
      typeof feature.renderLat === 'number'
    ) {
      return {
        type: 'Point',
        coordinates: [feature.renderLon, feature.renderLat],
      };
    }

    if (feature.geometryStatus !== 'VALID' || !feature.geometry) {
      return null;
    }
    return feature.geometry as Readonly<Record<string, unknown>>;
  }

  private fitCoverage(response: ResearchSpatialCoverageResponse): void {
    if (!this.map || !this.mapModule) {
      return;
    }

    const bounds = new this.mapModule.LngLatBounds();
    for (const feature of response.features) {
      const geometry = this.renderGeometry(feature);
      if (geometry) {
        this.collectCoordinates(geometry['coordinates'], bounds);
      }
    }

    if (!bounds.isEmpty()) {
      this.map.fitBounds(bounds, {
        padding: this.expanded ? 48 : 22,
        maxZoom: this.expanded ? 7 : 5,
        duration: 0,
      });
    }
  }

  private fitCensusArea(boundary: CensusAreaBoundary): void {
    if (!this.map) {
      return;
    }
    this.map.fitBounds(
      [
        [boundary.west, boundary.south],
        [boundary.east, boundary.north],
      ],
      {
        padding: this.expanded ? 44 : 22,
        maxZoom: boundary.defaultZoom,
        duration: 0,
      },
    );
  }

  private collectCoordinates(
    value: unknown,
    bounds: import('maplibre-gl').LngLatBounds,
  ): void {
    if (!Array.isArray(value)) {
      return;
    }
    if (
      value.length >= 2 &&
      typeof value[0] === 'number' &&
      typeof value[1] === 'number'
    ) {
      bounds.extend([value[0], value[1]]);
      return;
    }
    for (const child of value) {
      this.collectCoordinates(child, bounds);
    }
  }

  private requestCurrentViewport(): void {
    if (!this.interactive || !this.map) {
      return;
    }
    const bounds = this.map.getBounds();
    this.currentViewport = {
      west: this.normalizeLongitude(bounds.getWest()),
      south: Math.max(-85, bounds.getSouth()),
      east: this.normalizeLongitude(bounds.getEast()),
      north: Math.min(85, bounds.getNorth()),
    };
    this.requests.next({
      query: this.query,
      viewport: this.currentViewport,
    });
  }

  private normalizeLongitude(longitude: number): number {
    const normalized = ((((longitude + 180) % 360) + 360) % 360) - 180;
    return normalized === -180 && longitude > 0 ? 180 : normalized;
  }
}
