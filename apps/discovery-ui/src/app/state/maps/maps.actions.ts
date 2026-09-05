import { createActionGroup, emptyProps, props } from '@ngrx/store';
import type {
  CensusAreaBoundary,
  LodesFlowOverlay,
  LodesWorkplaceOverlay,
  MapLayer,
  PopulationEstimateMeasure,
  PopulationEstimatesChoropleth,
  RepositoryError,
  ResearchSpatialCoverageResponse,
  ResearchSpatialViewport,
  SaipeCountyChoropleth,
  SearchQuery,
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
    'Lodes Workplace Overlay Loaded': props<{
      lodesWorkplaceOverlay: LodesWorkplaceOverlay;
    }>(),
    'Lodes Workplace Overlay Failed': props<{ error: RepositoryError }>(),
    'Saipe Choropleth Loaded': props<{
      saipeChoropleth: SaipeCountyChoropleth;
    }>(),
    'Saipe Choropleth Failed': props<{ error: RepositoryError }>(),
    'Population Estimates Configuration Changed': props<{
      measure: PopulationEstimateMeasure;
      year: number;
    }>(),
    'Population Estimates Requested': emptyProps(),
    'Population Estimates Loaded': props<{
      populationEstimatesChoropleth: PopulationEstimatesChoropleth;
    }>(),
    'Population Estimates Failed': props<{ error: RepositoryError }>(),
    'Research Coverage Requested': props<{
      query: SearchQuery;
      viewport: ResearchSpatialViewport;
    }>(),
    'Research Coverage Loaded': props<{
      response: ResearchSpatialCoverageResponse;
    }>(),
    'Research Coverage Failed': props<{ error: RepositoryError }>(),
    'Census Area Selected': props<{ geography: string }>(),
    'Tiger Layer Toggled': props<{ visible: boolean }>(),
    'Earthquake Layer Toggled': props<{ visible: boolean }>(),
    'Lodes Layer Toggled': props<{ visible: boolean }>(),
    'Workplace Layer Toggled': props<{ visible: boolean }>(),
    'Hydrography Layer Toggled': props<{ visible: boolean }>(),
    'Saipe Layer Toggled': props<{ visible: boolean }>(),
    'Population Layer Toggled': props<{ visible: boolean }>(),
    'Research Coverage Layer Toggled': props<{ visible: boolean }>(),
    'Research Coverage Feature Selected': props<{
      sourceIdentifier: string;
    }>(),
    'Research Coverage Selection Cleared': emptyProps(),
    'Map Feature Selected': props<{ featureId: string }>(),
    /** A commuting flow, chosen from either the map or the accessible table. */
    'Lodes Flow Selected': props<{ flowId: string }>(),
    'Lodes Flow Selection Cleared': emptyProps(),
    'Map Feature Selection Cleared': emptyProps(),
  },
});
