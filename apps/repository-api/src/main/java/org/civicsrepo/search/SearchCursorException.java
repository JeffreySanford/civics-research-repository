package org.civicsrepo.search;

/**
 * Controlled client error for malformed, stale or incompatible search continuation tokens.
 *
 * <p>A cursor is navigation state, not an authorization token. Invalid cursor input must fail
 * explicitly rather than falling back to an offset or silently restarting traversal.
 */
public class SearchCursorException extends IllegalArgumentException {
    public SearchCursorException(String message) {
        super(message);
    }

    public SearchCursorException(String message, Throwable cause) {
        super(message, cause);
    }
}
