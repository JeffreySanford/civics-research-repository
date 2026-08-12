package org.civicsrepo.dspace;

import static org.assertj.core.api.Assertions.assertThat;
import static org.civicsrepo.dspace.DspaceDiscoveryFixtures.discoveryResponse;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.List;
import java.util.Map;
import org.civicsrepo.sources.TigerLineMetadataAdapter;
import org.junit.jupiter.api.Test;

class DspaceRestItemWriteGatewayTest {
    private static final String SOURCE_IDENTIFIER = "tiger-line-north-dakota-2025";

    private final DspaceRestClient client = new DspaceRestClient("http://localhost:8081/server", "", "");
    private final DspaceRestItemWriteGateway gateway = new DspaceRestItemWriteGateway(client);
    private final DspaceItemPayload sourcePayload =
            new DspaceItemPayloadMapper().toItemPayload(new TigerLineMetadataAdapter().firstVisualSlice());

    @Test
    void plansDublinCoreMetadataPatchOperationsForChangedFields() {
        JsonNode item = firstItem(
                """
                {
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
                      {"value": "2025-01-01", "language": null, "authority": null, "confidence": -1}
                    ]
                  }
                }
                """);

        List<Map<String, Object>> operations = gateway.metadataPatchOperations(item, SOURCE_IDENTIFIER, sourcePayload);

        assertThat(operations).anySatisfy((operation) -> {
            assertThat(operation.get("op")).isEqualTo("replace");
            assertThat(operation.get("path")).isEqualTo("/metadata/dc.date.issued");
        });
        assertThat(operations).anySatisfy((operation) -> {
            assertThat(operation.get("op")).isEqualTo("add");
            assertThat(operation.get("path")).isEqualTo("/metadata/dc.identifier.other");
        });
        assertThat(operations).anySatisfy((operation) -> {
            assertThat(operation.get("op")).isEqualTo("add");
            assertThat(operation.get("path")).isEqualTo("/metadata/crr.identifier.source");
        });
    }

    @Test
    void leavesUnchangedFieldsAlone() {
        JsonNode item = firstItem(
                """
                {
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
                    ]
                  }
                }
                """);

        List<Map<String, Object>> operations = gateway.metadataPatchOperations(item, SOURCE_IDENTIFIER, sourcePayload);

        assertThat(operations).noneSatisfy((operation) -> assertThat(operation.get("path")).isEqualTo("/metadata/dc.title"));
    }

    /**
     * DSpace returns repeated values ordered by {@code place}, which need not match adapter order.
     * An order-sensitive comparison would re-PATCH identical metadata on every apply.
     */
    @Test
    void treatsReorderedRepeatedValuesAsEquivalent() {
        JsonNode item = firstItem(
                """
                {
                  "type": "item",
                  "withdrawn": false,
                  "metadata": {
                    "dc.subject": [
                      {"value": "Second", "language": "en_US", "authority": null, "confidence": -1},
                      {"value": "First", "language": "en_US", "authority": null, "confidence": -1}
                    ]
                  }
                }
                """);

        List<DspaceMetadataValue> sourceValues = List.of(
                new DspaceMetadataValue("First", "en_US", null, -1),
                new DspaceMetadataValue("Second", "en_US", null, -1));

        assertThat(gateway.hasEquivalentMetadataValues(item, "dc.subject", sourceValues)).isTrue();
    }

    @Test
    void detectsChangedRepeatedValuesRegardlessOfOrder() {
        JsonNode item = firstItem(
                """
                {
                  "type": "item",
                  "withdrawn": false,
                  "metadata": {
                    "dc.subject": [
                      {"value": "Second", "language": "en_US", "authority": null, "confidence": -1},
                      {"value": "Renamed", "language": "en_US", "authority": null, "confidence": -1}
                    ]
                  }
                }
                """);

        List<DspaceMetadataValue> sourceValues = List.of(
                new DspaceMetadataValue("First", "en_US", null, -1),
                new DspaceMetadataValue("Second", "en_US", null, -1));

        assertThat(gateway.hasEquivalentMetadataValues(item, "dc.subject", sourceValues)).isFalse();
    }

    @Test
    void treatsDifferingLanguageAsAChange() {
        JsonNode item = firstItem(
                """
                {
                  "type": "item",
                  "withdrawn": false,
                  "metadata": {
                    "dc.subject": [{"value": "First", "language": "fr", "authority": null, "confidence": -1}]
                  }
                }
                """);

        assertThat(gateway.hasEquivalentMetadataValues(
                        item, "dc.subject", List.of(new DspaceMetadataValue("First", "en_US", null, -1))))
                .isFalse();
    }

    @Test
    void skipsReconciliationWhenCredentialsAreNotConfigured() {
        assertThat(gateway.ensureItemMetadata(SOURCE_IDENTIFIER, sourcePayload)).isFalse();
    }

    private JsonNode firstItem(String indexableObject) {
        return client.toDiscoverableItems(discoveryResponse(indexableObject)).getFirst();
    }
}
