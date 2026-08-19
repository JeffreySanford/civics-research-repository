package org.civicsrepo.maps;

import static org.assertj.core.api.Assertions.assertThat;

import java.net.URI;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;

class LodesFlowServiceTest {

    /**
     * A client that never reaches the publisher, which is what CI and an offline machine look like.
     *
     * <p>Stubbed rather than mocked so the test states the contract in one place: derivation either
     * produces flows or it does not, and the service's job is to degrade in a stated order.
     */
    private static LodesOdFlowClient clientReturning(List<LodesOdFlowClient.CountyFlow> flows) {
        return new LodesOdFlowClient(new CountyGazetteer("http://localhost:0/unreachable"), true, 8, 2023, 30) {
            @Override
            public Optional<List<LodesOdFlowClient.CountyFlow>> findTopFlows(String stateAbbreviation) {
                return flows.isEmpty() ? Optional.empty() : Optional.of(flows);
            }
        };
    }

    private final LodesFlowService offlineService =
            new LodesFlowService(new CensusAreaBoundaryService(), clientReturning(List.of()));

    @Test
    void servesNorthDakotaFixtureFlowsWhenDerivationIsUnavailable() {
        var overlay = offlineService.findFlowSample("North Dakota");

        assertThat(overlay.getGeography()).isEqualTo("North Dakota");
        assertThat(overlay.getFlows()).isNotEmpty();
        assertThat(overlay.getFlows().getFirst().getWorkerCount()).isPositive();
        assertThat(overlay.getGeoJson()).isNotNull();
    }

    /**
     * The stored sample is a fallback, and must say so.
     *
     * <p>It previously reported {@code fallback: false}, which told the UI that a committed
     * approximation was current published data.
     */
    @Test
    void storedSampleIsReportedAsAFallback() {
        var overlay = offlineService.findFlowSample("North Dakota");

        assertThat(overlay.getFallback()).isTrue();
        assertThat(overlay.getSource()).contains("stored sample");
    }

    @Test
    void generatesFallbackFlowsForUnknownFixtureState() {
        var overlay = offlineService.findFlowSample("Wyoming");

        assertThat(overlay.getGeography()).isEqualTo("Wyoming");
        assertThat(overlay.getFallback()).isTrue();
        assertThat(overlay.getFlows()).hasSize(3);
    }

    /** Derived flows win outright, and are labelled as measurements rather than as a sample. */
    @Test
    void derivedFlowsReplaceTheStoredSample() {
        var derived = new LodesOdFlowClient.CountyFlow(
                "lodes-38059-38015", "Morton", "Burleigh", 8615, -101.28, 46.71, -100.47, 46.96);

        var service = new LodesFlowService(new CensusAreaBoundaryService(), clientReturning(List.of(derived)));
        var overlay = service.findFlowSample("North Dakota");

        assertThat(overlay.getFallback()).isFalse();
        assertThat(overlay.getSource()).contains("aggregated to counties");
        assertThat(overlay.getFlows()).hasSize(1);
        assertThat(overlay.getFlows().getFirst().getWorkerCount()).isEqualTo(8615);
        assertThat(overlay.getFlows().getFirst().getOriginCounty()).isEqualTo("Morton");
        assertThat(overlay.getFlows().getFirst().getDestinationCounty()).isEqualTo("Burleigh");
    }

    @Test
    void sourceUrlNamesThePublishedOriginDestinationFile() {
        var client = new LodesOdFlowClient(new CountyGazetteer("http://localhost:0/unreachable"), true, 8, 2023, 30);

        assertThat(client.sourceUrl("ND"))
                .isEqualTo(URI.create(
                        "https://lehd.ces.census.gov/data/lodes/LODES8/nd/od/nd_od_main_JT00_2023.csv.gz"));
    }

    /** Disabled derivation must not reach the network at all, so the demo can run offline. */
    @Test
    void derivationCanBeDisabled() {
        var client = new LodesOdFlowClient(new CountyGazetteer("http://localhost:0/unreachable"), false, 8, 2023, 30);

        assertThat(client.isEnabled()).isFalse();
        assertThat(client.findTopFlows("nd")).isEmpty();
    }
}
