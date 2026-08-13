import { createActionGroup, emptyProps, props } from '@ngrx/store';
import type {
  CensusAreaBoundary,
  LodesFlowOverlay,
  MapLayer,
  RepositoryError,
  SaipeCountyChoropleth,
  UsgsEarthquakeOverlay,
} from 'repository-api-client';

export const MapsActions = createActionGroup({
  source: 'Repository Maps',
  events: {
    'Map Opened': emptyProps(),
    'Map Data Loaded': props<{
      censusAreaBoundaries: CensusAreaBoundary[];
    }>(),
    'Map Data Failed': props<{ error: RepositoryError }>(),
    'Map Layers Loaded': props<{ layers: MapLayer[] }>(),
    'Earthquake Overlay Loaded': props<{
      earthquakeOverlay: UsgsEarthquakeOverlay;
    }>(),
    'Earthquake Overlay Failed': props<{ error: RepositoryError }>(),
    'Lodes Flow Overlay Loaded': props<{
      lodesFlowOverlay: LodesFlowOverlay;
    }>(),
    'Lodes Flow Overlay Failed': props<{ error: RepositoryError }>(),
    'Saipe Choropleth Loaded': props<{
      saipeChoropleth: SaipeCountyChoropleth;
    }>(),
    'Saipe Choropleth Failed': props<{ error: RepositoryError }>(),
    'Census Area Selected': props<{ geography: string }>(),
    'Tiger Layer Toggled': props<{ visible: boolean }>(),
    'Earthquake Layer Toggled': props<{ visible: boolean }>(),
    'Lodes Layer Toggled': props<{ visible: boolean }>(),
    'Hydrography Layer Toggled': props<{ visible: boolean }>(),
    'Saipe Layer Toggled': props<{ visible: boolean }>(),
    'Map Feature Selected': props<{ featureId: string }>(),
    'Map Feature Selection Cleared': emptyProps(),
  },
});
