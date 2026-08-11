package org.civicsrepo.maps;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class MapLayerServiceTest {
    private final MapLayerService mapLayerService = new MapLayerService();

    @Test
    void includesLodesSampleLayerWithCensusDataType() {
        assertThat(mapLayerService.findDatasetLayers("tiger-line-north-dakota-2025"))
                .anySatisfy(layer -> {
                    assertThat(layer.id()).isEqualTo("lodes-workplace-flow-sample");
                    assertThat(layer.layerType()).isEqualTo(MapLayerType.CENSUS_DATA);
                    assertThat(layer.attribution()).contains("LEHD Origin-Destination Employment Statistics");
                });
    }
}
