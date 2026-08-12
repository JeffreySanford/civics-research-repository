package org.civicsrepo.maps;

import java.util.List;
import org.civicsrepo.generated.dto.CensusAreaBoundary;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping
public class MapsController {
    private final CensusAreaBoundaryService censusAreaBoundaryService;
    private final MapLayerService mapLayerService;
    private final UsgsEarthquakeService usgsEarthquakeService;

    public MapsController(
            CensusAreaBoundaryService censusAreaBoundaryService,
            MapLayerService mapLayerService,
            UsgsEarthquakeService usgsEarthquakeService) {
        this.censusAreaBoundaryService = censusAreaBoundaryService;
        this.mapLayerService = mapLayerService;
        this.usgsEarthquakeService = usgsEarthquakeService;
    }

    @GetMapping("/datasets/{datasetId}/map-layers")
    public List<MapLayer> getDatasetMapLayers(@PathVariable String datasetId) {
        return mapLayerService.findDatasetLayers(datasetId);
    }

    @GetMapping("/maps/census-areas")
    public List<CensusAreaBoundary> listCensusAreaBoundaries() {
        return censusAreaBoundaryService.listBoundaries();
    }

    @GetMapping("/overlays/usgs/earthquakes")
    public UsgsEarthquakeOverlay getUsgsEarthquakeOverlay(
            @RequestParam(defaultValue = "0") double minMagnitude, @RequestParam(defaultValue = "7") int days) {
        return usgsEarthquakeService.findEarthquakes(minMagnitude, days);
    }
}
