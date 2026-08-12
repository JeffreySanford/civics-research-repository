package org.civicsrepo.dspace;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class DspaceDiscoveryItemStateReaderTest {
    @Test
    void mapsPublicDiscoveryItemMetadataIntoPayload() {
        DspaceDiscoveryItemStateReader reader = new DspaceDiscoveryItemStateReader("http://localhost:8081/server");

        DspaceItemPayload payload = reader.toFirstItemPayload(
                        """
                        {
                          "_embedded": {
                            "searchResult": {
                              "_embedded": {
                                "objects": [
                                  {
                                    "_embedded": {
                                      "indexableObject": {
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
                                            {
                                              "value": "U.S. Census Bureau",
                                              "language": "en_US",
                                              "authority": null,
                                              "confidence": -1
                                            }
                                          ]
                                        }
                                      }
                                    }
                                  }
                                ]
                              }
                            }
                          }
                        }
                        """)
                .orElseThrow();

        assertThat(payload.name()).isEqualTo("2025 TIGER/Line - Census Tracts - North Dakota");
        assertThat(payload.type()).isEqualTo("item");
        assertThat(payload.metadata().get("dc.title"))
                .containsExactly(new DspaceMetadataValue("2025 TIGER/Line - Census Tracts - North Dakota", "en_US", null, -1));
        assertThat(payload.metadata().get("dc.publisher"))
                .containsExactly(new DspaceMetadataValue("U.S. Census Bureau", "en_US", null, -1));
        assertThat(payload.bitstreams()).isEmpty();
    }

    @Test
    void ignoresWithdrawnItems() {
        DspaceDiscoveryItemStateReader reader = new DspaceDiscoveryItemStateReader("http://localhost:8081/server");

        assertThat(reader.toFirstItemPayload(
                        """
                        {
                          "_embedded": {
                            "searchResult": {
                              "_embedded": {
                                "objects": [
                                  {
                                    "_embedded": {
                                      "indexableObject": {
                                        "type": "item",
                                        "name": "Withdrawn item",
                                        "withdrawn": true,
                                        "metadata": {}
                                      }
                                    }
                                  }
                                ]
                              }
                            }
                          }
                        }
                        """))
                .isEmpty();
    }
}
