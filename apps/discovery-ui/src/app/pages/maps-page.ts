import { isPlatformBrowser } from '@angular/common';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  PLATFORM_ID,
  ViewChild,
  inject,
} from '@angular/core';
import type { Map as MapLibreMap, StyleSpecification } from 'maplibre-gl';

@Component({
  selector: 'app-maps-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './maps-page.html',
})
export class MapsPage implements AfterViewInit, OnDestroy {
  @ViewChild('mapCanvas', { static: true })
  private readonly mapCanvas!: ElementRef<HTMLDivElement>;

  private readonly platformId = inject(PLATFORM_ID);
  private map: MapLibreMap | null = null;

  protected tigerVisible = true;
  protected earthquakeVisible = true;

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
    this.tigerVisible = visible;
    this.setLayerVisibility(
      ['north-dakota-fill', 'north-dakota-outline'],
      visible,
    );
  }

  protected toggleEarthquakeLayer(visible: boolean): void {
    this.earthquakeVisible = visible;
    this.setLayerVisibility(['usgs-earthquake-points'], visible);
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

    this.map.on('load', () => this.addDemoLayers());
  }

  private addDemoLayers(): void {
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

    this.map.addSource('usgs-earthquakes', {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: { place: 'Western North Dakota', magnitude: 2.4 },
            geometry: { type: 'Point', coordinates: [-103.21, 47.35] },
          },
          {
            type: 'Feature',
            properties: { place: 'Central North Dakota', magnitude: 1.8 },
            geometry: { type: 'Point', coordinates: [-100.78, 47.02] },
          },
          {
            type: 'Feature',
            properties: { place: 'Eastern North Dakota', magnitude: 2.1 },
            geometry: { type: 'Point', coordinates: [-97.73, 48.1] },
          },
        ],
      },
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
