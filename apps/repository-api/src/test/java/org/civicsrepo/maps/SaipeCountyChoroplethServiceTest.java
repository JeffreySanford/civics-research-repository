package org.civicsrepo.maps;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class SaipeCountyChoroplethServiceTest {
    private final SaipeCountyChoroplethService choroplethService =
            new SaipeCountyChoroplethService(new CensusAreaBoundaryService());

    @Test
    void servesNorthDakotaCountyValues() {
        var choropleth = choroplethService.findChoropleth("North Dakota");

        assertThat(choropleth.getGeography()).isEqualTo("North Dakota");
        assertThat(choropleth.getCounties()).hasSizeGreaterThan(10);
        assertThat(choropleth.getCounties().getFirst().getPovertyRate()).isPositive();
        assertThat(choropleth.getGeoJson()).isNotNull();
    }

    @Test
    void servesCaliforniaCountyValues() {
        var choropleth = choroplethService.findChoropleth("California");

        assertThat(choropleth.getGeography()).isEqualTo("California");
        assertThat(choropleth.getCounties()).hasSize(10);
    }
}
