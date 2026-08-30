package org.civicsrepo.federation;

/** One source record rejected during normalization without aborting the surrounding source page. */
public record HarvestRejection(String sourceIdentifier, String message, String rawSnippet) {
    private static final int MAX_MESSAGE_LENGTH = 2_000;
    private static final int MAX_RAW_SNIPPET_LENGTH = 8_000;

    public HarvestRejection {
        sourceIdentifier = normalize(sourceIdentifier, 500);
        message = normalize(message, MAX_MESSAGE_LENGTH);
        rawSnippet = normalize(rawSnippet, MAX_RAW_SNIPPET_LENGTH);
        if (message == null) {
            throw new IllegalArgumentException("message must not be blank");
        }
    }

    private static String normalize(String value, int maxLength) {
        if (value == null || value.isBlank()) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.length() <= maxLength ? trimmed : trimmed.substring(0, maxLength);
    }
}
