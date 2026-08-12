package org.civicsrepo.maps;

import java.net.URI;
import java.util.List;
import java.util.Locale;
import org.civicsrepo.generated.dto.CensusAreaBoundary;
import org.civicsrepo.generated.dto.MapLayer;
import org.civicsrepo.generated.dto.MapLayerType;
import org.springframework.stereotype.Service;

/**
 * Map layers available for a dataset.
 *
 * <p>This previously ignored its argument and always described North Dakota, so switching the
 * selected Census area changed the map viewport but not the layer list underneath it: every state
 * claimed North Dakota's layers. The geography is now derived from the dataset identifier, which is
 * the same slug convention the repository seeds (`tiger-line-north-dakota-2025`).
 */
@Service
public class MapLayerService {
    private static final String DEFAULT_GEOGRAPHY = "United States";

    private final CensusAreaBoundaryService censusAreaBoundaryService;

    public MapLayerService(CensusAreaBoundaryService censusAreaBoundaryService) {
        this.censusAreaBoundaryService = censusAreaBoundaryService;
    }

    public List<MapLayer> findDatasetLayers(String datasetId) {
        String geography = geographyFor(datasetId);
        String slug = slugFor(geography);

        return List.of(
                new MapLayer(
                                "tiger-line-" + slug + "-boundary",
                                "2025 TIGER/Line - Census Tracts - " + geography,
                                MapLayerType.CENSUS_BOUNDARY,
                                URI.create(
                                        "https://www.census.gov/geographies/mapping-files/time-series/geo/tiger-line-file.html"),
                                "U.S. Census Bureau TIGER/Line")
                        .visibleByDefault(true),
                new MapLayer(
                                "lodes-workplace-flow-" + slug,
                                "2023 LODES workplace flow sample - " + geography,
                                MapLayerType.CENSUS_DATA,
                                URI.create("https://lehd.ces.census.gov/data/"),
                                "U.S. Census Bureau LEHD Origin-Destination Employment Statistics")
                        .visibleByDefault(true),
                new MapLayer(
                                "usgs-earthquakes-" + slug,
                                "USGS earthquake overlay",
                                MapLayerType.USGS_EARTHQUAKE,
                                URI.create("https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson"),
                                "U.S. Geological Survey Earthquake Hazards Program")
                        .visibleByDefault(true));
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
