package org.civicsrepo.maps;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class LodesFlowServiceTest {
    private final LodesFlowService lodesFlowService =
            new LodesFlowService(new CensusAreaBoundaryService());

    @Test
    void servesNorthDakotaFixtureFlows() {
        var overlay = lodesFlowService.findFlowSample("North Dakota");

        assertThat(overlay.getGeography()).isEqualTo("North Dakota");
        assertThat(overlay.getFlows()).isNotEmpty();
        assertThat(overlay.getFlows().getFirst().getWorkerCount()).isPositive();
        assertThat(overlay.getGeoJson()).isNotNull();
    }

    @Test
    void generatesFallbackFlowsForUnknownFixtureState() {
        var overlay = lodesFlowService.findFlowSample("Wyoming");

        assertThat(overlay.getGeography()).isEqualTo("Wyoming");
        assertThat(overlay.getFallback()).isTrue();
        assertThat(overlay.getFlows()).hasSize(3);
    }
}
