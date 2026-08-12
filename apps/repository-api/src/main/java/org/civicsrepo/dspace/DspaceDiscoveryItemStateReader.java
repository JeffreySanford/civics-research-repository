package org.civicsrepo.dspace;

import com.fasterxml.jackson.databind.JsonNode;
import java.io.IOException;
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
     * Diff is a read-only report, so transport and ambiguity problems degrade to "unknown state"
     * rather than failing the sync job. The apply path refuses to write in the same situations.
     */
    private Optional<DspaceItemPayload> readItem(String sourceIdentifier, String expectedTitle) {
        try {
            return dspaceRestClient.findItem(sourceIdentifier, expectedTitle).map(this::toItemPayload);
        } catch (AmbiguousDspaceItemException exception) {
            LOGGER.warn("DSpace item state is ambiguous for {}: {}", sourceIdentifier, exception.getMessage());
            return Optional.empty();
        } catch (IllegalStateException exception) {
            LOGGER.warn("DSpace discovery failed while reading item state: {}", exception.getMessage());
            return Optional.empty();
        } catch (IOException exception) {
            LOGGER.warn("DSpace discovery request failed while reading item state: {}", exception.getMessage());
            return Optional.empty();
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            LOGGER.warn("DSpace discovery request was interrupted while reading item state.");
            return Optional.empty();
        }
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
