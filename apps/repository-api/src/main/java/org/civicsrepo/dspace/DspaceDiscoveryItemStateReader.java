package org.civicsrepo.dspace;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

@Component
public class DspaceDiscoveryItemStateReader implements DspaceItemStateReader {
    private static final Logger LOGGER = LoggerFactory.getLogger(DspaceDiscoveryItemStateReader.class);

    private final DspaceRestClient dspaceRestClient;

    public DspaceDiscoveryItemStateReader(DspaceRestClient dspaceRestClient) {
        this.dspaceRestClient = dspaceRestClient;
    }

    @Override
    public Optional<DspaceItemPayload> findBySourceIdentifier(String sourceIdentifier) {
        return readItem(sourceIdentifier, "");
    }

    @Override
    public Optional<DspaceItemPayload> findMatchingItem(String sourceIdentifier, DspaceItemPayload sourcePayload) {
        return readItem(sourceIdentifier, sourcePayload.name());
    }

    /**
     * An empty result means "DSpace is reachable and does not hold this item", and nothing else.
     *
     * <p>This previously swallowed every failure into {@link Optional#empty()}, so an unreachable
     * DSpace made {@code sync:diff} confidently report {@code CREATE_ITEM} for an item it had never
     * actually looked for. Being unable to answer is not the same as answering "absent", so
     * unavailability and ambiguity both propagate and fail the job with a message that says what to
     * do about it.
     */
    private Optional<DspaceItemPayload> readItem(String sourceIdentifier, String expectedTitle) {
        if (!dspaceRestClient.isReadEnabled()) {
            LOGGER.info("DSpace is not configured; reporting no repository item state.");
            return Optional.empty();
        }

        return dspaceRestClient.findItem(sourceIdentifier, expectedTitle).map(this::toItemPayload);
    }

    DspaceItemPayload toItemPayload(JsonNode item) {
        return new DspaceItemPayload(
                item.path("name").asText(),
                item.path("type").asText("item"),
                metadata(item.path("metadata")),
                List.of());
    }

    private Map<String, List<DspaceMetadataValue>> metadata(JsonNode metadata) {
        Map<String, List<DspaceMetadataValue>> values = new LinkedHashMap<>();
        for (Map.Entry<String, JsonNode> field : metadata.properties()) {
            List<DspaceMetadataValue> fieldValues = new ArrayList<>();
            for (JsonNode value : field.getValue()) {
                fieldValues.add(new DspaceMetadataValue(
                        value.path("value").asText(),
                        nullableText(value.path("language")),
                        nullableText(value.path("authority")),
                        value.path("confidence").isMissingNode() || value.path("confidence").isNull()
                                ? null
                                : value.path("confidence").asInt()));
            }
            values.put(field.getKey(), List.copyOf(fieldValues));
        }
        return Map.copyOf(values);
    }

    private String nullableText(JsonNode node) {
        return node.isMissingNode() || node.isNull() ? null : node.asText();
    }
}
