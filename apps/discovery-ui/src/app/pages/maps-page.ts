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
import { Store } from '@ngrx/store';
import { combineLatest } from 'rxjs';
import type {
  GeoJSONSource,
  Map as MapLibreMap,
  StyleSpecification,
} from 'maplibre-gl';
import type { UsgsEarthquakeOverlay } from 'repository-api-client';
import { MapsActions } from '../state/maps/maps.actions';
import {
  selectEarthquakeOverlay,
  selectEarthquakeVisible,
  selectMapLayers,
  selectMapsError,
  selectMapsLoading,
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
  private map: MapLibreMap | null = null;
  private pendingEarthquakeOverlay: UsgsEarthquakeOverlay | null = null;
  private mapLoaded = false;

  protected readonly layers$ = this.store.select(selectMapLayers);
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
    this.store.dispatch(MapsActions.mapOpened());

    this.earthquakeOverlay$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((overlay) => {
        this.pendingEarthquakeOverlay = overlay;
        this.renderEarthquakeOverlay();
      });

    combineLatest([this.tigerVisible$, this.earthquakeVisible$])
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(([tigerVisible, earthquakeVisible]) => {
        this.setLayerVisibility(
          ['north-dakota-fill', 'north-dakota-outline'],
          tigerVisible,
        );
        this.setLayerVisibility(['usgs-earthquake-points'], earthquakeVisible);
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
  }

  protected toggleEarthquakeLayer(visible: boolean): void {
    this.store.dispatch(MapsActions.earthquakeLayerToggled({ visible }));
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
      this.addCensusBoundaryLayer();
      this.renderEarthquakeOverlay();
    });
  }

  private addCensusBoundaryLayer(): void {
    if (!this.map) {
      return;
    }

    this.map.addSource('north-dakota-boundary', {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: {
              label: '2025 TIGER/Line Census Tracts - North Dakota',
            },
            geometry: {
              type: 'Polygon',
              coordinates: [
                [
                  [-104.0489, 45.9351],
                  [-96.5545, 45.9351],
                  [-96.5545, 49.0007],
                  [-104.0489, 49.0007],
                  [-104.0489, 45.9351],
                ],
              ],
            },
          },
        ],
      },
    });

    this.map.addLayer({
      id: 'north-dakota-fill',
      type: 'fill',
      source: 'north-dakota-boundary',
      paint: {
        'fill-color': '#2f6f8f',
        'fill-opacity': 0.18,
      },
    });

    this.map.addLayer({
      id: 'north-dakota-outline',
      type: 'line',
      source: 'north-dakota-boundary',
      paint: {
        'line-color': '#164e63',
        'line-width': 2,
      },
    });
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
          1,
          5,
          3,
          12,
        ],
        'circle-stroke-color': '#ffffff',
        'circle-stroke-width': 2,
      },
    });
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
