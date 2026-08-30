package org.civicsrepo.federation;

import java.time.Duration;

/**
 * Source-fetch failure with explicit retry semantics.
 *
 * <p>Adapters should use a retryable failure for transient publisher/network conditions such as
 * HTTP 429 or 5xx responses, and may carry the publisher's Retry-After delay. Validation/schema
 * failures should be permanent so the shared harvester does not turn bad source data into a retry
 * storm.
 */
public class FederatedHarvestException extends RuntimeException {
    private final boolean retryable;
    private final Duration retryAfter;

    private FederatedHarvestException(String message, Throwable cause, boolean retryable, Duration retryAfter) {
        super(message, cause);
        this.retryable = retryable;
        this.retryAfter = retryAfter == null || retryAfter.isNegative() ? null : retryAfter;
    }

    public static FederatedHarvestException retryable(String message) {
        return new FederatedHarvestException(message, null, true, null);
    }

    public static FederatedHarvestException retryable(String message, Duration retryAfter) {
        return new FederatedHarvestException(message, null, true, retryAfter);
    }

    public static FederatedHarvestException retryable(String message, Throwable cause, Duration retryAfter) {
        return new FederatedHarvestException(message, cause, true, retryAfter);
    }

    public static FederatedHarvestException permanent(String message) {
        return new FederatedHarvestException(message, null, false, null);
    }

    public static FederatedHarvestException permanent(String message, Throwable cause) {
        return new FederatedHarvestException(message, cause, false, null);
    }

    public boolean retryable() {
        return retryable;
    }

    public Duration retryAfter() {
        return retryAfter;
    }
}
