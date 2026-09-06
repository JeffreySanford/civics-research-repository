package org.civicsrepo.maps;

import java.net.URI;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import org.civicsrepo.generated.dto.CensusAreaBoundary;
import org.civicsrepo.generated.dto.MapLayer;
import org.civicsrepo.generated.dto.MapLayerType;
import org.springframework.stereotype.Service;

/**
 * Map layers available for a dataset.
 *
 * <p>Layer capability is derived from the selected geography and the data the repository actually
 * retains. A thematic control is not advertised merely because the upstream program exists; the
 * corresponding service must be able to serve real values for that geography.
 */
@Service
public class MapLayerService {
    private static final String DEFAULT_GEOGRAPHY = "United States";

    private final CensusAreaBoundaryService censusAreaBoundaryService;
    private final SaipeCountyChoroplethService saipeCountyChoroplethService;
    private final PopulationEstimatesService populationEstimatesService;

    public MapLayerService(
            CensusAreaBoundaryService censusAreaBoundaryService,
            SaipeCountyChoroplethService saipeCountyChoroplethService,
            PopulationEstimatesService populationEstimatesService) {
        this.censusAreaBoundaryService = censusAreaBoundaryService;
        this.saipeCountyChoroplethService = saipeCountyChoroplethService;
        this.populationEstimatesService = populationEstimatesService;
    }

    public List<MapLayer> findDatasetLayers(String datasetId) {
        String geography = geographyFor(datasetId);
        String slug = slugFor(geography);
        List<MapLayer> layers = new ArrayList<>();

        layers.add(new MapLayer(
                        "tiger-line-" + slug + "-boundary",
                        "2025 TIGER/Line - Census Tracts - " + geography,
                        MapLayerType.CENSUS_BOUNDARY,
                        URI.create("https://www.census.gov/geographies/mapping-files/time-series/geo/tiger-line-file.html"),
                        "U.S. Census Bureau TIGER/Line")
                .visibleByDefault(true));

        layers.add(new MapLayer(
                        "lodes-workplace-flow-" + slug,
                        "2023 LODES commuting flows - " + geography,
                        MapLayerType.CENSUS_DATA,
                        URI.create("https://lehd.ces.census.gov/data/"),
                        "U.S. Census Bureau LEHD Origin-Destination Employment Statistics")
                .visibleByDefault(true));

        if (saipeCountyChoroplethService.supportsGeography(geography)) {
            layers.add(new MapLayer(
                            "saipe-county-poverty-" + slug,
                            "2023 SAIPE county poverty - " + geography,
                            MapLayerType.CENSUS_CHOROPLETH,
                            URI.create("https://www.census.gov/data/datasets/2023/demo-saipe/2023-state-and-county.html"),
                            "U.S. Census Bureau Small Area Income and Poverty Estimates")
                    .visibleByDefault(true));
        }

        if (populationEstimatesService.supportsGeography(geography)) {
            layers.add(new MapLayer(
                            "population-estimates-county-" + slug,
                            "Vintage 2025 county Population Estimates - " + geography,
                            MapLayerType.CENSUS_CHOROPLETH,
                            URI.create(
                                    "https://www2.census.gov/programs-surveys/popest/datasets/2020-2025/counties/totals/co-est2025-alldata.csv"),
                            "U.S. Census Bureau Population Estimates Program")
                    .visibleByDefault(false));
        }

        layers.add(new MapLayer(
                        "usgs-3hp-hydrography",
                        "USGS 3D Hydrography Program reference",
                        MapLayerType.USGS_REFERENCE,
                        URI.create("https://hydro.nationalmap.gov/arcgis/rest/services/3DHP_all/MapServer"),
                        "U.S. Geological Survey 3D Hydrography Program")
                .visibleByDefault(false)
                .rasterTileUrlTemplate(
                        "/overlays/usgs/hydrography/export?bbox={bbox-epsg-3857}&bboxSR=3857&imageSR=3857&size=256,256&f=image&transparent=true"));

        layers.add(new MapLayer(
                        "usgs-3dep-terrain",
                        "USGS 3DEP terrain",
                        MapLayerType.USGS_REFERENCE,
                        URI.create(
                                "https://elevation.nationalmap.gov/arcgis/rest/services/3DEPElevation/ImageServer"),
                        "USGS National Map 3D Elevation Program (3DEP)")
                .visibleByDefault(false)
                .rasterTileUrlTemplate(
                        "/overlays/usgs/terrain/export?bbox={bbox-epsg-3857}&mode=hillshade"));

        layers.add(new MapLayer(
                        "usgs-earthquakes-" + slug,
                        "USGS earthquake overlay",
                        MapLayerType.USGS_EARTHQUAKE,
                        URI.create("https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson"),
                        "U.S. Geological Survey Earthquake Hazards Program")
                .visibleByDefault(true));

        return List.copyOf(layers);
    }

    /**
     * Resolves the geography a dataset identifier refers to.
     *
     * <p>Matched against the known Census area boundaries rather than parsed positionally, because
     * identifiers carry both a program prefix and a vintage suffix and the area slug in between can
     * contain hyphens ("district-of-columbia").
     */
    private String geographyFor(String datasetId) {
        String normalized = datasetId == null ? "" : datasetId.toLowerCase(Locale.ROOT);

        return censusAreaBoundaryService.listBoundaries().stream()
                .filter((boundary) -> normalized.contains(boundary.getId()))
                .map(CensusAreaBoundary::getGeography)
                // The longest match wins: "north-dakota" and "dakota" would both match otherwise.
                .reduce((shorter, longer) -> longer.length() >= shorter.length() ? longer : shorter)
                .orElse(DEFAULT_GEOGRAPHY);
    }

    private String slugFor(String geography) {
        return geography.toLowerCase(Locale.ROOT).replace(' ', '-');
    }
}
