package org.civicsrepo.evidence;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.io.InputStream;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import org.civicsrepo.generated.dto.AccessibilityEvidence;
import org.civicsrepo.generated.dto.EvidenceStatus;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * Serves accessibility evidence summaries from the committed release manifest.
 *
 * <p>Automated suites write transient Playwright output to {@code test-results/} and
 * {@code playwright-report/}; the durable record lives under
 * {@code documentation/accessibility-evidence/}. This service reads a classpath manifest that
 * mirrors the latest dated baseline so the Angular evidence view can show status without parsing
 * markdown at runtime.
 */
@Service
public class AccessibilityEvidenceService {
    private static final Logger LOGGER = LoggerFactory.getLogger(AccessibilityEvidenceService.class);
    private static final String RESOURCE = "/accessibility-evidence-manifest.json";

    private final List<AccessibilityEvidence> entries;

    public AccessibilityEvidenceService() {
        this.entries = loadManifest(new ObjectMapper());
    }

    public List<AccessibilityEvidence> listEvidence() {
        return entries;
    }

    private static List<AccessibilityEvidence> loadManifest(ObjectMapper objectMapper) {
        try (InputStream stream = AccessibilityEvidenceService.class.getResourceAsStream(RESOURCE)) {
            if (stream == null) {
                throw new IllegalStateException("Missing accessibility evidence manifest: " + RESOURCE);
            }

            JsonNode root = objectMapper.readTree(stream);
            if (!root.isArray()) {
                throw new IllegalStateException("Accessibility evidence manifest must be a JSON array");
            }

            List<AccessibilityEvidence> loaded = new ArrayList<>();
            for (JsonNode node : root) {
                loaded.add(toEvidence(node));
            }

            return List.copyOf(loaded);
        } catch (IOException exception) {
            LOGGER.error("Failed to load accessibility evidence manifest", exception);
            throw new IllegalStateException("Could not read accessibility evidence manifest", exception);
        }
    }

    private static AccessibilityEvidence toEvidence(JsonNode node) {
        AccessibilityEvidence evidence = new AccessibilityEvidence(
                node.path("id").asText(),
                node.path("workflow").asText(),
                EvidenceStatus.fromValue(node.path("status").asText()),
                AccessibilityEvidence.StandardEnum.fromValue(node.path("standard").asText()),
                OffsetDateTime.parse(node.path("capturedAt").asText()));

        if (node.hasNonNull("notes")) {
            evidence.notes(node.path("notes").asText());
        }

        return evidence;
    }
}
