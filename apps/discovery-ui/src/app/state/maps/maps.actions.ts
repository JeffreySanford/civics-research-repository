import { createActionGroup, emptyProps, props } from '@ngrx/store';
import type {
  CensusAreaBoundary,
  MapLayer,
  UsgsEarthquakeOverlay,
} from 'repository-api-client';

export const MapsActions = createActionGroup({
  source: 'Repository Maps',
  events: {
    'Map Opened': emptyProps(),
    'Map Data Loaded': props<{
      censusAreaBoundaries: CensusAreaBoundary[];
    }>(),
    'Map Data Failed': props<{ error: string }>(),
    'Map Layers Loaded': props<{ layers: MapLayer[] }>(),
    'Earthquake Overlay Loaded': props<{
      earthquakeOverlay: UsgsEarthquakeOverlay;
    }>(),
    'Earthquake Overlay Failed': props<{ error: string }>(),
    'Census Area Selected': props<{ geography: string }>(),
    'Tiger Layer Toggled': props<{ visible: boolean }>(),
    'Earthquake Layer Toggled': props<{ visible: boolean }>(),
    'Lodes Layer Toggled': props<{ visible: boolean }>(),
    'Map Feature Selected': props<{ featureId: string }>(),
    'Map Feature Selection Cleared': emptyProps(),
  },
});
