import { createActionGroup, emptyProps, props } from '@ngrx/store';
import type { MapLayer, UsgsEarthquakeOverlay } from 'repository-api-client';

export const MapsActions = createActionGroup({
  source: 'Repository Maps',
  events: {
    'Map Opened': emptyProps(),
    'Map Data Loaded': props<{
      layers: MapLayer[];
      earthquakeOverlay: UsgsEarthquakeOverlay;
    }>(),
    'Map Data Failed': props<{ error: string }>(),
    'Tiger Layer Toggled': props<{ visible: boolean }>(),
    'Earthquake Layer Toggled': props<{ visible: boolean }>(),
  },
});
