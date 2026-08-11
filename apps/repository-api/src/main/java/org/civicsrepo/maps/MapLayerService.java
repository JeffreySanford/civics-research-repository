package org.civicsrepo.maps;

import java.util.List;
import org.springframework.stereotype.Service;

@Service
public class MapLayerService {
    public List<MapLayer> findDatasetLayers(String datasetId) {
        return List.of(
                new MapLayer(
                        "tiger-line-nd-boundary",
                        "2025 TIGER/Line - Census Tracts - North Dakota",
                        MapLayerType.CENSUS_BOUNDARY,
                        "https://www.census.gov/geographies/mapping-files/time-series/geo/tiger-line-file.html",
                        "U.S. Census Bureau TIGER/Line",
                        true),
                new MapLayer(
                        "usgs-earthquakes-nd",
                        "USGS earthquake overlay",
                        MapLayerType.USGS_EARTHQUAKE,
                        "https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson",
                        "U.S. Geological Survey Earthquake Hazards Program",
                        true));
    }
}
