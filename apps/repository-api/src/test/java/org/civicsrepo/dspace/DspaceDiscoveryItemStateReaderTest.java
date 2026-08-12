package org.civicsrepo.dspace;

import static org.assertj.core.api.Assertions.assertThat;
import static org.civicsrepo.dspace.DspaceDiscoveryFixtures.discoveryResponse;

import org.junit.jupiter.api.Test;

class DspaceDiscoveryItemStateReaderTest {
    private final DspaceRestClient client = new DspaceRestClient("http://localhost:8081/server", "", "");
    private final DspaceDiscoveryItemStateReader reader = new DspaceDiscoveryItemStateReader(client);

    @Test
    void mapsPublicDiscoveryItemMetadataIntoPayload() {
        DspaceItemPayload payload = reader.toItemPayload(client.toDiscoverableItems(discoveryResponse(
                        """
                        {
                          "type": "item",
                          "name": "2025 TIGER/Line - Census Tracts - North Dakota",
                          "withdrawn": false,
                          "metadata": {
                            "dc.title": [
                              {
                                "value": "2025 TIGER/Line - Census Tracts - North Dakota",
                                "language": "en_US",
                                "authority": null,
                                "confidence": -1
                              }
                            ],
                            "dc.publisher": [
                              {"value": "U.S. Census Bureau", "language": "en_US", "authority": null, "confidence": -1}
                            ]
                          }
                        }
                        """))
                .getFirst());

        assertThat(payload.name()).isEqualTo("2025 TIGER/Line - Census Tracts - North Dakota");
        assertThat(payload.type()).isEqualTo("item");
        assertThat(payload.metadata().get("dc.title"))
                .containsExactly(new DspaceMetadataValue("2025 TIGER/Line - Census Tracts - North Dakota", "en_US", null, -1));
        assertThat(payload.metadata().get("dc.publisher"))
                .containsExactly(new DspaceMetadataValue("U.S. Census Bureau", "en_US", null, -1));
        assertThat(payload.bitstreams()).isEmpty();
    }

    @Test
    void readsNullMetadataAttributesAsNullRatherThanText() {
        DspaceItemPayload payload = reader.toItemPayload(client.toDiscoverableItems(discoveryResponse(
                        """
                        {
                          "type": "item",
                          "name": "Item without language",
                          "withdrawn": false,
                          "metadata": {
                            "dc.date.issued": [
                              {"value": "2025-01-01", "language": null, "authority": null, "confidence": null}
                            ]
                          }
                        }
                        """))
                .getFirst());

        assertThat(payload.metadata().get("dc.date.issued"))
                .containsExactly(new DspaceMetadataValue("2025-01-01", null, null, null));
    }

    @Test
    void reportsUnknownStateWhenDspaceIsNotConfigured() {
        DspaceDiscoveryItemStateReader disabledReader =
                new DspaceDiscoveryItemStateReader(new DspaceRestClient("", "", ""));

        assertThat(disabledReader.findBySourceIdentifier("tiger-line-north-dakota-2025"))
                .isEmpty();
    }
}
