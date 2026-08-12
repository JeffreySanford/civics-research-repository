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

        // An existing field is cleared first, then re-appended value by value.
        assertThat(operations).anySatisfy((operation) -> {
            assertThat(operation.get("op")).isEqualTo("remove");
            assertThat(operation.get("path")).isEqualTo("/metadata/dc.date.issued");
        });
        assertThat(operations).anySatisfy((operation) -> {
            assertThat(operation.get("op")).isEqualTo("add");
            assertThat(operation.get("path")).isEqualTo("/metadata/dc.date.issued/-");
        });
        assertThat(operations).anySatisfy((operation) -> {
            assertThat(operation.get("op")).isEqualTo("add");
            assertThat(operation.get("path")).isEqualTo("/metadata/dc.identifier.other/-");
        });
        assertThat(operations).anySatisfy((operation) -> {
            assertThat(operation.get("op")).isEqualTo("add");
            assertThat(operation.get("path")).isEqualTo("/metadata/crr.identifier.source/-");
        });

        // An absent field is not removed first; there is nothing to remove.
        assertThat(operations).noneSatisfy((operation) -> {
            assertThat(operation.get("op")).isEqualTo("remove");
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

        assertThat(operations)
                .noneSatisfy((operation) -> assertThat(operation.get("path").toString()).startsWith("/metadata/dc.title"));
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

    /**
     * The manifest is the first genuinely multi-valued field sync writes, and the bug it exposed —
     * DSpace keeping only the first element of a value array — is invisible with single-valued
     * fields.
     */
    @Test
    void emitsOneAddOperationPerValueForAMultiValuedField() {
        JsonNode item = firstItem(
                """
                {"type": "item", "withdrawn": false, "metadata": {}}
                """);

        List<Map<String, Object>> operations = gateway.metadataPatchOperations(item, SOURCE_IDENTIFIER, sourcePayload);

        assertThat(operations)
                .filteredOn((operation) ->
                        ("/metadata/" + DspaceFileManifest.FIELD + "/-").equals(operation.get("path")))
                .hasSize(sourcePayload.bitstreams().size())
                .allSatisfy((operation) -> assertThat(operation.get("op")).isEqualTo("add"));
    }

    private JsonNode firstItem(String indexableObject) {
        return client.toDiscoverableItems(discoveryResponse(indexableObject)).getFirst();
    }
}
