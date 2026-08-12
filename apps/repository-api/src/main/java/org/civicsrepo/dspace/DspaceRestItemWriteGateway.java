package org.civicsrepo.dspace;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Component;

@Component
public class DspaceRestItemWriteGateway implements DspaceItemWriteGateway {
    private static final String SOURCE_IDENTIFIER_FIELD = DspaceItemMatcher.SOURCE_IDENTIFIER_FIELD;
    private static final List<String> WRITABLE_METADATA_FIELDS = List.of(
            "dc.title",
            "dc.contributor.author",
            "dc.publisher",
            "dc.description.abstract",
            "dc.date.issued",
            "dc.identifier.uri",
            "dc.relation.uri",
            "dc.identifier.citation",
            "dc.subject",
            "dc.coverage.spatial",
            "crr.identifier.source",
            "crr.program",
            "crr.geography.level",
            "crr.vintage",
            "crr.source.url",
            "crr.documentation.url",
            SOURCE_IDENTIFIER_FIELD);

    private final DspaceRestClient dspaceRestClient;

    public DspaceRestItemWriteGateway(DspaceRestClient dspaceRestClient) {
        this.dspaceRestClient = dspaceRestClient;
    }

    @Override
    public boolean ensureItemMetadata(String sourceIdentifier, DspaceItemPayload sourcePayload) {
        if (!dspaceRestClient.isWriteEnabled()) {
            return false;
        }

        // Transport failures surface as DspaceUnavailableException, which names the endpoint and
        // the command that starts it. Nothing is swallowed here: a failed apply must fail the job.
        JsonNode item = dspaceRestClient
                .findItem(sourceIdentifier, sourcePayload.name())
                .orElseThrow(() -> new IllegalStateException("DSpace item was not found for " + sourceIdentifier
                        + ". Run pnpm run dspace:seed to create the seed repository objects."));

        List<Map<String, Object>> patchOperations = metadataPatchOperations(item, sourceIdentifier, sourcePayload);
        if (patchOperations.isEmpty()) {
            return false;
        }

        dspaceRestClient.patchItemMetadata(item.path("uuid").asText(), patchOperations);
        return true;
    }

    List<Map<String, Object>> metadataPatchOperations(
            JsonNode item, String sourceIdentifier, DspaceItemPayload sourcePayload) {
        Map<String, List<DspaceMetadataValue>> sourceMetadata = new LinkedHashMap<>(sourcePayload.metadata());
        sourceMetadata.put(
                SOURCE_IDENTIFIER_FIELD,
                List.of(new DspaceMetadataValue(sourceIdentifier, "en_US", null, -1)));

        List<Map<String, Object>> operations = new ArrayList<>();
        for (String field : WRITABLE_METADATA_FIELDS) {
            List<DspaceMetadataValue> sourceValues = sourceMetadata.getOrDefault(field, List.of());
            if (sourceValues.isEmpty() || hasEquivalentMetadataValues(item, field, sourceValues)) {
                continue;
            }

            Map<String, Object> operation = new LinkedHashMap<>();
            operation.put("op", item.path("metadata").has(field) ? "replace" : "add");
            operation.put("path", "/metadata/" + field);
            operation.put("value", metadataValues(sourceValues));
            operations.add(operation);
        }
        return List.copyOf(operations);
    }

    /**
     * Compares source and DSpace values as unordered multisets.
     *
     * <p>DSpace orders repeated values by {@code place}, which is not guaranteed to match the order
     * the adapter emits. An index-by-index comparison would therefore report a difference on every
     * run and re-PATCH unchanged metadata, breaking the idempotence that {@code sync:apply} relies
     * on.
     */
    boolean hasEquivalentMetadataValues(JsonNode item, String field, List<DspaceMetadataValue> sourceValues) {
        JsonNode existingValues = item.path("metadata").path(field);
        if (!existingValues.isArray() || existingValues.size() != sourceValues.size()) {
            return false;
        }

        List<List<String>> remaining =
                new ArrayList<>(sourceValues.stream().map(this::comparisonKey).toList());
        for (JsonNode existingValue : existingValues) {
            List<String> key = comparisonKey(
                    existingValue.path("value").asText(), existingValue.path("language").asText(null));
            if (!remaining.remove(key)) {
                return false;
            }
        }
        return remaining.isEmpty();
    }

    private List<String> comparisonKey(DspaceMetadataValue value) {
        return comparisonKey(value.value(), value.language());
    }

    /** Value/language pair compared structurally, so no delimiter can collide with metadata text. */
    private List<String> comparisonKey(String value, String language) {
        return List.of(normalize(value), normalize(language));
    }

    private List<Map<String, Object>> metadataValues(List<DspaceMetadataValue> values) {
        return values.stream().map(this::metadataValue).toList();
    }

    private Map<String, Object> metadataValue(DspaceMetadataValue value) {
        Map<String, Object> metadataValue = new LinkedHashMap<>();
        metadataValue.put("value", value.value());
        metadataValue.put("language", value.language());
        metadataValue.put("authority", value.authority());
        metadataValue.put("confidence", value.confidence());
        return metadataValue;
    }

    private String normalize(String value) {
        return value == null ? "" : value.trim();
    }
}
