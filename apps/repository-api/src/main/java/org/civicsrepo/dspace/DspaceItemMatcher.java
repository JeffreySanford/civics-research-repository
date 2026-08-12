package org.civicsrepo.dspace;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.List;
import java.util.Optional;

/**
 * Selects the single DSpace item that a source identifier refers to.
 *
 * <p>DSpace discovery is a relevance-ranked full-text search, so the first result is not
 * necessarily the right item. Taking the first hit is safe only while the repository holds one
 * item; once several similarly titled research objects exist it will resolve to a sibling. Every
 * selection here is therefore explicit:
 *
 * <ol>
 *   <li>An item already carrying {@code dc.identifier.other = <sourceIdentifier>} is the target.
 *   <li>Otherwise an <em>unclaimed</em> item (no source identifier at all) whose title matches the
 *       normalized payload exactly may be adopted. This is the first-apply case, where the seeded
 *       item has not yet been stamped with its identifier.
 *   <li>Anything ambiguous fails loudly rather than picking a winner.
 * </ol>
 */
public final class DspaceItemMatcher {
    static final String SOURCE_IDENTIFIER_FIELD = "dc.identifier.other";
    private static final String TITLE_FIELD = "dc.title";

    private DspaceItemMatcher() {}

    public static Optional<JsonNode> selectTargetItem(
            List<JsonNode> candidates, String sourceIdentifier, String expectedTitle) {
        List<JsonNode> claimed = candidates.stream()
                .filter((item) -> hasMetadataValue(item, SOURCE_IDENTIFIER_FIELD, sourceIdentifier))
                .toList();

        if (claimed.size() == 1) {
            return Optional.of(claimed.getFirst());
        }
        if (claimed.size() > 1) {
            throw new AmbiguousDspaceItemException("DSpace discovery returned " + claimed.size()
                    + " items already carrying " + SOURCE_IDENTIFIER_FIELD + " = " + sourceIdentifier
                    + ". Resolve the duplicate items before syncing.");
        }

        List<JsonNode> adoptable = candidates.stream()
                .filter((item) -> !hasAnyMetadataValue(item, SOURCE_IDENTIFIER_FIELD))
                .filter((item) -> titleMatches(item, expectedTitle))
                .toList();

        if (adoptable.size() == 1) {
            return Optional.of(adoptable.getFirst());
        }
        if (adoptable.size() > 1) {
            throw new AmbiguousDspaceItemException("DSpace discovery returned " + adoptable.size()
                    + " unclaimed items titled \"" + expectedTitle + "\" for source identifier " + sourceIdentifier
                    + ". Resolve the duplicate items before syncing.");
        }

        return Optional.empty();
    }

    public static boolean hasMetadataValue(JsonNode item, String field, String value) {
        for (JsonNode metadataValue : item.path("metadata").path(field)) {
            if (normalize(value).equals(normalize(metadataValue.path("value").asText()))) {
                return true;
            }
        }
        return false;
    }

    private static boolean hasAnyMetadataValue(JsonNode item, String field) {
        for (JsonNode metadataValue : item.path("metadata").path(field)) {
            if (!normalize(metadataValue.path("value").asText()).isBlank()) {
                return true;
            }
        }
        return false;
    }

    private static boolean titleMatches(JsonNode item, String expectedTitle) {
        if (normalize(expectedTitle).isBlank()) {
            return false;
        }
        if (hasMetadataValue(item, TITLE_FIELD, expectedTitle)) {
            return true;
        }
        return normalize(item.path("name").asText()).equals(normalize(expectedTitle));
    }

    private static String normalize(String value) {
        return value == null ? "" : value.trim();
    }
}
