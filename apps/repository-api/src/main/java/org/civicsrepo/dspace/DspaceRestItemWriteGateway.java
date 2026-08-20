package org.civicsrepo.dspace;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.civicsrepo.repository.RepositoryIdentityStore;
import org.springframework.stereotype.Component;

@Component
public class DspaceRestItemWriteGateway implements DspaceItemWriteGateway {
    private static final String SOURCE_IDENTIFIER_FIELD = DspaceManagedFields.SOURCE_IDENTIFIER_FIELD;
    private static final List<String> WRITABLE_METADATA_FIELDS = DspaceManagedFields.ALL;

    private final DspaceRestClient dspaceRestClient;
    private final RepositoryIdentityStore repositoryIdentityStore;

    public DspaceRestItemWriteGateway(
            DspaceRestClient dspaceRestClient, RepositoryIdentityStore repositoryIdentityStore) {
        this.dspaceRestClient = dspaceRestClient;
        this.repositoryIdentityStore = repositoryIdentityStore;
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

        String itemUuid = item.path("uuid").asText();

        // Recorded before deciding whether to write. Resolving the item is what establishes the
        // identity; whether its metadata happened to need patching is a separate question, and
        // recording only on write would leave every already-current object without one.
        repositoryIdentityStore.recordDspaceItem(sourceIdentifier, itemUuid, sourceUrlOf(sourcePayload));

        List<Map<String, Object>> patchOperations = metadataPatchOperations(item, sourceIdentifier, sourcePayload);
        if (patchOperations.isEmpty()) {
            return false;
        }

        dspaceRestClient.patchItemMetadata(itemUuid, patchOperations);
        return true;
    }

    /** The publisher URL from the payload's own metadata, so the identity row records provenance. */
    private String sourceUrlOf(DspaceItemPayload sourcePayload) {
        List<DspaceMetadataValue> values = sourcePayload.metadata().get(DspaceManagedFields.SOURCE_URL_FIELD);
        return values == null || values.isEmpty() ? null : values.getFirst().value();
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

            operations.addAll(replaceFieldOperations(item, field, sourceValues));
        }
        return List.copyOf(operations);
    }

    /**
     * Clears a field, then appends each value individually.
     *
     * <p>DSpace accepts an array as the value of a single {@code add} on {@code /metadata/<field>}
     * and silently keeps only the first element, so a three-entry file manifest arrived as one
     * entry and the next diff correctly reported the field as still differing. Appending through
     * {@code /-} is the form that actually stores every value.
     */
    private List<Map<String, Object>> replaceFieldOperations(
            JsonNode item, String field, List<DspaceMetadataValue> sourceValues) {
        List<Map<String, Object>> operations = new ArrayList<>();

        if (item.path("metadata").has(field)) {
            Map<String, Object> remove = new LinkedHashMap<>();
            remove.put("op", "remove");
            remove.put("path", "/metadata/" + field);
            operations.add(remove);
        }

        for (DspaceMetadataValue value : sourceValues) {
            Map<String, Object> add = new LinkedHashMap<>();
            add.put("op", "add");
            add.put("path", "/metadata/" + field + "/-");
            add.put("value", metadataValue(value));
            operations.add(add);
        }

        return operations;
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
