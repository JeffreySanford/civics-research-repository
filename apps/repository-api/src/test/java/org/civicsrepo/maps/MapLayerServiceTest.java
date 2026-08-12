package org.civicsrepo.maps;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class MapLayerServiceTest {
    private final MapLayerService mapLayerService = new MapLayerService(new CensusAreaBoundaryService());

    @Test
    void includesLodesSampleLayerWithCensusDataType() {
        assertThat(mapLayerService.findDatasetLayers("tiger-line-north-dakota-2025"))
                .anySatisfy(layer -> {
                    assertThat(layer.id()).isEqualTo("lodes-workplace-flow-north-dakota");
                    assertThat(layer.layerType()).isEqualTo(MapLayerType.CENSUS_DATA);
                    assertThat(layer.attribution()).contains("LEHD Origin-Destination Employment Statistics");
                });
    }

    /**
     * The dataset argument was previously ignored, so every state was described by North Dakota's
     * layers however the map was navigated.
     */
    @Test
    void describesTheGeographyTheDatasetBelongsTo() {
        assertThat(mapLayerService.findDatasetLayers("tiger-line-california-2025"))
                .extracting(MapLayer::label)
                .allSatisfy(label -> assertThat(label).doesNotContain("North Dakota"))
                .anySatisfy(label -> assertThat(label).isEqualTo("2025 TIGER/Line - Census Tracts - California"));
    }

    /** The area slug can contain hyphens, so it cannot be read off a fixed position in the id. */
    @Test
    void resolvesMultiWordAreaSlugs() {
        assertThat(mapLayerService.findDatasetLayers("tiger-line-district-of-columbia-2025"))
                .extracting(MapLayer::id)
                .contains("tiger-line-district-of-columbia-boundary", "lodes-workplace-flow-district-of-columbia");
    }

    /** "west-virginia" contains "virginia", so the longest match has to win. */
    @Test
    void prefersTheLongestMatchingArea() {
        assertThat(mapLayerService.findDatasetLayers("tiger-line-west-virginia-2025"))
                .extracting(MapLayer::label)
                .anySatisfy(label -> assertThat(label).isEqualTo("2025 TIGER/Line - Census Tracts - West Virginia"));
    }

    /** An identifier that names no known area must not silently claim one. */
    @Test
    void fallsBackToTheNationalGeography() {
        assertThat(mapLayerService.findDatasetLayers("some-unmapped-dataset-2025"))
                .extracting(MapLayer::label)
                .anySatisfy(label -> assertThat(label).contains("United States"));
    }
}
