package org.civicsrepo.maps;

import java.util.List;
import java.time.Duration;
import org.civicsrepo.generated.dto.CensusAreaBoundary;
import org.civicsrepo.generated.dto.LodesFlowOverlay;
import org.civicsrepo.generated.dto.LodesWorkplaceOverlay;
import org.civicsrepo.generated.dto.MapLayer;
import org.civicsrepo.generated.dto.PopulationEstimateMeasure;
import org.civicsrepo.generated.dto.PopulationEstimatesChoropleth;
import org.civicsrepo.generated.dto.SaipeCountyChoropleth;
import org.civicsrepo.generated.dto.UsgsEarthquakeOverlay;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping
public class MapsController {
    private final CensusAreaBoundaryService censusAreaBoundaryService;
    private final MapLayerService mapLayerService;
    private final UsgsEarthquakeService usgsEarthquakeService;
    private final LodesFlowService lodesFlowService;
    private final LodesWorkplaceService lodesWorkplaceService;
    private final SaipeCountyChoroplethService saipeCountyChoroplethService;
    private final PopulationEstimatesService populationEstimatesService;
    private final UsgsHydrographyTileService usgsHydrographyTileService;

    public MapsController(
            CensusAreaBoundaryService censusAreaBoundaryService,
            MapLayerService mapLayerService,
            UsgsEarthquakeService usgsEarthquakeService,
            LodesFlowService lodesFlowService,
            LodesWorkplaceService lodesWorkplaceService,
            SaipeCountyChoroplethService saipeCountyChoroplethService,
            PopulationEstimatesService populationEstimatesService,
            UsgsHydrographyTileService usgsHydrographyTileService) {
        this.censusAreaBoundaryService = censusAreaBoundaryService;
        this.mapLayerService = mapLayerService;
        this.usgsEarthquakeService = usgsEarthquakeService;
        this.lodesFlowService = lodesFlowService;
        this.lodesWorkplaceService = lodesWorkplaceService;
        this.saipeCountyChoroplethService = saipeCountyChoroplethService;
        this.populationEstimatesService = populationEstimatesService;
        this.usgsHydrographyTileService = usgsHydrographyTileService;
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

    @GetMapping(value = "/overlays/usgs/hydrography/export", produces = MediaType.IMAGE_PNG_VALUE)
    public ResponseEntity<byte[]> getUsgsHydrographyTileExport(
            @RequestParam String bbox,
            @RequestParam(defaultValue = "3857") int bboxSR,
            @RequestParam(defaultValue = "3857") int imageSR,
            @RequestParam(defaultValue = "256,256") String size,
            @RequestParam(defaultValue = "true") boolean transparent) {
        byte[] tile = usgsHydrographyTileService.exportTile(bbox, bboxSR, imageSR, size, transparent);
        return ResponseEntity.ok()
                .cacheControl(CacheControl.maxAge(Duration.ofHours(1)).cachePublic())
                .contentType(MediaType.IMAGE_PNG)
                .body(tile);
    }

    @GetMapping("/overlays/census/lodes-workplace")
    public LodesWorkplaceOverlay getLodesWorkplaceOverlay(
            @RequestParam(defaultValue = "North Dakota") String geography) {
        try {
            return lodesWorkplaceService.findWorkplaceEmployment(geography);
        } catch (IllegalArgumentException exception) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, exception.getMessage(), exception);
        }
    }

    @GetMapping("/overlays/census/lodes-flow")
    public LodesFlowOverlay getLodesFlowOverlay(@RequestParam(defaultValue = "North Dakota") String geography) {
        try {
            return lodesFlowService.findFlowSample(geography);
        } catch (IllegalArgumentException exception) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, exception.getMessage(), exception);
        }
    }

    @GetMapping("/overlays/census/population-estimates")
    public PopulationEstimatesChoropleth getPopulationEstimatesChoropleth(
            @RequestParam(defaultValue = "North Dakota") String geography,
            @RequestParam(defaultValue = "ANNUAL_GROWTH_RATE")
                    PopulationEstimateMeasure measure,
            @RequestParam(defaultValue = "2025") int year) {
        try {
            return populationEstimatesService.findChoropleth(
                    geography, measure, year);
        } catch (PopulationEstimatesService.InvalidQueryException exception) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    exception.getMessage(),
                    exception);
        } catch (IllegalArgumentException exception) {
            throw new ResponseStatusException(
                    HttpStatus.NOT_FOUND,
                    exception.getMessage(),
                    exception);
        }
    }

    @GetMapping("/overlays/census/saipe-counties")
    public SaipeCountyChoropleth getSaipeCountyChoropleth(
            @RequestParam(defaultValue = "North Dakota") String geography) {
        try {
            return saipeCountyChoroplethService.findChoropleth(geography);
        } catch (IllegalArgumentException exception) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, exception.getMessage(), exception);
        }
    }
}
