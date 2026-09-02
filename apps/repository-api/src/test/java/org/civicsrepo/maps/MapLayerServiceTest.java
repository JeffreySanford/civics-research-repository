package org.civicsrepo.maps;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.http.HttpClient;
import java.util.Map;
import org.civicsrepo.generated.dto.MapLayer;
import org.civicsrepo.generated.dto.MapLayerType;
import org.junit.jupiter.api.Test;

class MapLayerServiceTest {
    private final CensusAreaBoundaryService boundaries = new CensusAreaBoundaryService();
    private final SaipeCountyChoroplethService saipe = new SaipeCountyChoroplethService(
            boundaries,
            new AdministrativeGeometryService(
                    Map.of(
                            2023, "https://example.test/2023/counties/query",
                            2025, "https://example.test/2025/counties/query"),
                    HttpClient.newHttpClient(),
                    new ObjectMapper()));
    private final MapLayerService mapLayerService = new MapLayerService(boundaries, saipe);

    @Test
    void includesReferenceAndChoroplethLayersWhereSaipeValuesExist() {
        assertThat(mapLayerService.findDatasetLayers("tiger-line-north-dakota-2025"))
                .extracting(MapLayer::getLayerType)
                .contains(
                        MapLayerType.CENSUS_CHOROPLETH,
                        MapLayerType.USGS_REFERENCE,
                        MapLayerType.USGS_EARTHQUAKE);
    }

    @Test
    void omitsSaipeLayerWhereNoValuesAreRetained() {
        assertThat(mapLayerService.findDatasetLayers("tiger-line-florida-2025"))
                .extracting(MapLayer::getId)
                .doesNotContain("saipe-county-poverty-florida");
    }

    @Test
    void includesLodesSampleLayerWithCensusDataType() {
        assertThat(mapLayerService.findDatasetLayers("tiger-line-north-dakota-2025"))
                .anySatisfy(layer -> {
                    assertThat(layer.getId()).isEqualTo("lodes-workplace-flow-north-dakota");
                    assertThat(layer.getLayerType()).isEqualTo(MapLayerType.CENSUS_DATA);
                    assertThat(layer.getAttribution()).contains("LEHD Origin-Destination Employment Statistics");
                });
    }

    /**
     * The dataset argument was previously ignored, so every state was described by North Dakota's
     * layers however the map was navigated.
     */
    @Test
    void describesTheGeographyTheDatasetBelongsTo() {
        assertThat(mapLayerService.findDatasetLayers("tiger-line-california-2025"))
                .extracting(MapLayer::getLabel)
                .allSatisfy(label -> assertThat(label).doesNotContain("North Dakota"))
                .anySatisfy(label -> assertThat(label).isEqualTo("2025 TIGER/Line - Census Tracts - California"));
    }

    /** The area slug can contain hyphens, so it cannot be read off a fixed position in the id. */
    @Test
    void resolvesMultiWordAreaSlugs() {
        assertThat(mapLayerService.findDatasetLayers("tiger-line-district-of-columbia-2025"))
                .extracting(MapLayer::getId)
                .contains("tiger-line-district-of-columbia-boundary", "lodes-workplace-flow-district-of-columbia");
    }

    /** "west-virginia" contains "virginia", so the longest match has to win. */
    @Test
    void prefersTheLongestMatchingArea() {
        assertThat(mapLayerService.findDatasetLayers("tiger-line-west-virginia-2025"))
                .extracting(MapLayer::getLabel)
                .anySatisfy(label -> assertThat(label).isEqualTo("2025 TIGER/Line - Census Tracts - West Virginia"));
    }

    /** An identifier that names no known area must not silently claim one. */
    @Test
    void fallsBackToTheNationalGeography() {
        assertThat(mapLayerService.findDatasetLayers("some-unmapped-dataset-2025"))
                .extracting(MapLayer::getLabel)
                .anySatisfy(label -> assertThat(label).contains("United States"));
    }

    /** 3DHP_all is a dynamic MapServer; MapLibre must use proxied export bbox tiles. */
    @Test
    void hydrographyLayerUsesProxiedExportTileTemplate() {
        assertThat(mapLayerService.findDatasetLayers("tiger-line-north-dakota-2025"))
                .filteredOn(layer -> layer.getId().equals("usgs-3hp-hydrography"))
                .singleElement()
                .satisfies(layer -> assertThat(layer.getRasterTileUrlTemplate())
                        .contains("/overlays/usgs/hydrography/export?bbox={bbox-epsg-3857}")
                        .doesNotContain("hydro.nationalmap.gov")
                        .doesNotContain("/tile/{z}/{y}/{x}"));
    }
}
