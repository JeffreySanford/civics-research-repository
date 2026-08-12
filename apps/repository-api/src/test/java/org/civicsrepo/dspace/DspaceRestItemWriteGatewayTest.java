package org.civicsrepo.dspace;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.List;
import java.util.Map;
import org.civicsrepo.sources.TigerLineMetadataAdapter;
import org.junit.jupiter.api.Test;

class DspaceRestItemWriteGatewayTest {
    @Test
    void mapsFirstDiscoverableItemForWriteReconciliation() {
        DspaceRestItemWriteGateway gateway =
                new DspaceRestItemWriteGateway("http://localhost:8081/server", "admin@civics.local", "civics-admin");

        JsonNode item = gateway.toFirstDiscoverableItem(
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
                                        "uuid": "0cb9466d-0c21-4563-b17b-6c1485185d46",
                                        "name": "2025 TIGER/Line - Census Tracts - North Dakota",
                                        "withdrawn": false,
                                        "metadata": {}
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

        assertThat(item.path("uuid").asText()).isEqualTo("0cb9466d-0c21-4563-b17b-6c1485185d46");
        assertThat(item.path("name").asText()).isEqualTo("2025 TIGER/Line - Census Tracts - North Dakota");
    }

    @Test
    void detectsExistingSourceIdentifierMetadata() {
        DspaceRestItemWriteGateway gateway =
                new DspaceRestItemWriteGateway("http://localhost:8081/server", "admin@civics.local", "civics-admin");
        JsonNode item = gateway.toFirstDiscoverableItem(
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
                                        "withdrawn": false,
                                        "metadata": {
                                          "dc.identifier.other": [
                                            {
                                              "value": "tiger-line-north-dakota-2025",
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

        assertThat(gateway.hasMetadataValue(item, "dc.identifier.other", "tiger-line-north-dakota-2025"))
                .isTrue();
        assertThat(gateway.hasMetadataValue(item, "dc.identifier.other", "other-source"))
                .isFalse();
    }

    @Test
    void plansDublinCoreMetadataPatchOperationsForChangedFields() {
        DspaceRestItemWriteGateway gateway =
                new DspaceRestItemWriteGateway("http://localhost:8081/server", "admin@civics.local", "civics-admin");
        DspaceItemPayload sourcePayload = new DspaceItemPayloadMapper().toItemPayload(new TigerLineMetadataAdapter().firstVisualSlice());
        JsonNode item = gateway.toFirstDiscoverableItem(
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
                                          "dc.date.issued": [
                                            {
                                              "value": "2025-01-01",
                                              "language": null,
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

        List<Map<String, Object>> operations =
                gateway.metadataPatchOperations(item, "tiger-line-north-dakota-2025", sourcePayload);

        assertThat(operations).anySatisfy((operation) -> {
            assertThat(operation.get("op")).isEqualTo("replace");
            assertThat(operation.get("path")).isEqualTo("/metadata/dc.date.issued");
        });
        assertThat(operations).anySatisfy((operation) -> {
            assertThat(operation.get("op")).isEqualTo("add");
            assertThat(operation.get("path")).isEqualTo("/metadata/dc.identifier.other");
        });
    }
}
