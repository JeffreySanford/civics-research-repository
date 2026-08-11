import { AsyncPipe, DatePipe, isPlatformBrowser } from '@angular/common';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  OnInit,
  OnDestroy,
  PLATFORM_ID,
  ViewChild,
  inject,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { combineLatest, distinctUntilChanged, map } from 'rxjs';
import type {
  GeoJSONSource,
  Map as MapLibreMap,
  StyleSpecification,
} from 'maplibre-gl';
import type {
  CensusAreaBoundary,
  UsgsEarthquakeOverlay,
} from 'repository-api-client';
import { MapsActions } from '../state/maps/maps.actions';
import {
  selectCensusAreaBoundaries,
  selectEarthquakeOverlay,
  selectEarthquakeVisible,
  selectMapLayers,
  selectMapsError,
  selectMapsLoading,
  selectSelectedCensusAreaBoundary,
  selectSelectedGeography,
  selectTigerVisible,
} from '../state/maps/maps.selectors';

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

@Component({
  selector: 'app-maps-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AsyncPipe, DatePipe],
  templateUrl: './maps-page.html',
})
export class MapsPage implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('mapCanvas', { static: true })
  private readonly mapCanvas!: ElementRef<HTMLDivElement>;

  private readonly platformId = inject(PLATFORM_ID);
  private readonly destroyRef = inject(DestroyRef);
  private readonly store = inject(Store);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private map: MapLibreMap | null = null;
  private pendingBoundary: CensusAreaBoundary | null = null;
  private pendingEarthquakeOverlay: UsgsEarthquakeOverlay | null = null;
  private mapLoaded = false;
  private tigerVisible = true;
  private earthquakeVisible = true;

  protected readonly layers$ = this.store.select(selectMapLayers);
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
  protected readonly tigerVisible$ = this.store.select(selectTigerVisible);
  protected readonly earthquakeVisible$ = this.store.select(
    selectEarthquakeVisible,
  );
  protected readonly loading$ = this.store.select(selectMapsLoading);
  protected readonly error$ = this.store.select(selectMapsError);

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

    combineLatest([this.tigerVisible$, this.earthquakeVisible$])
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(([tigerVisible, earthquakeVisible]) => {
        this.tigerVisible = tigerVisible;
        this.earthquakeVisible = earthquakeVisible;
        this.setLayerVisibility(
          ['census-area-fill', 'census-area-outline'],
          tigerVisible,
        );
        this.setLayerVisibility(
          ['usgs-earthquake-points', 'usgs-earthquake-labels'],
          earthquakeVisible,
        );
      });
  }

  ngAfterViewInit(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    void this.initializeMap();
  }

  ngOnDestroy(): void {
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

  protected selectCensusArea(geography: string): void {
    this.store.dispatch(MapsActions.censusAreaSelected({ geography }));
    this.updateMapUrl({ geography });
  }

  private bindUrlState(): void {
    this.route.queryParamMap
      .pipe(
        map((params) => ({
          area: params.get('area'),
          tigerVisible: this.toVisibleState(params.get('tiger')),
          earthquakeVisible: this.toVisibleState(params.get('earthquakes')),
        })),
        distinctUntilChanged(
          (previous, current) =>
            previous.area === current.area &&
            previous.tigerVisible === current.tigerVisible &&
            previous.earthquakeVisible === current.earthquakeVisible,
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(({ area, tigerVisible, earthquakeVisible }) => {
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
            MapsActions.earthquakeLayerToggled({ visible: earthquakeVisible }),
          );
        }
      });
  }

  private updateMapUrl(options: {
    geography?: string;
    tigerVisible?: boolean;
    earthquakeVisible?: boolean;
  }): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        area: options.geography === undefined ? undefined : options.geography,
        tiger:
          options.tigerVisible === undefined
            ? undefined
            : this.toLayerParam(options.tigerVisible),
        earthquakes:
          options.earthquakeVisible === undefined
            ? undefined
            : this.toLayerParam(options.earthquakeVisible),
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

  private async initializeMap(): Promise<void> {
    const maplibregl = await import('maplibre-gl');

    this.map = new maplibregl.Map({
      container: this.mapCanvas.nativeElement,
      style: this.createBaseStyle(),
      center: [-100.469, 47.551],
      zoom: 5,
      maxZoom: 12,
      minZoom: 3,
    });

    this.map.addControl(
      new maplibregl.NavigationControl({ showCompass: false }),
      'top-right',
    );

    this.map.on('load', () => {
      this.mapLoaded = true;
      this.renderCensusBoundary();
      this.renderEarthquakeOverlay();
      this.applyLayerVisibility();
    });
  }

  private renderCensusBoundary(): void {
    if (!this.map || !this.mapLoaded || !this.pendingBoundary) {
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
      paint: {
        'fill-color': '#2f6f8f',
        'fill-opacity': 0.18,
      },
    });

    this.map.addLayer({
      id: 'census-area-outline',
      type: 'line',
      source: 'census-area-boundary',
      paint: {
        'line-color': '#164e63',
        'line-width': 2,
      },
    });

    this.fitSelectedBoundary(this.pendingBoundary);
    this.applyLayerVisibility();
  }

  private renderEarthquakeOverlay(): void {
    if (!this.map || !this.mapLoaded || !this.pendingEarthquakeOverlay) {
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
        'circle-opacity': 0.86,
        'circle-stroke-color': '#ffffff',
        'circle-stroke-width': 3,
      },
    });

    this.map.addLayer({
      id: 'usgs-earthquake-labels',
      type: 'symbol',
      source: 'usgs-earthquakes',
      layout: {
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
    for (const layerId of layerIds) {
      if (this.map?.getLayer(layerId)) {
        this.map.setLayoutProperty(
          layerId,
          'visibility',
          visible ? 'visible' : 'none',
        );
      }
    }
  }

  private applyLayerVisibility(): void {
    this.setLayerVisibility(
      ['census-area-fill', 'census-area-outline'],
      this.tigerVisible,
    );
    this.setLayerVisibility(
      ['usgs-earthquake-points', 'usgs-earthquake-labels'],
      this.earthquakeVisible,
    );
  }

  private createBaseStyle(): StyleSpecification {
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
          id: 'osm',
          type: 'raster',
          source: 'osm',
        },
      ],
    };
  }
}
