package org.civicsrepo.dspace;

/**
 * Raised when DSpace cannot be reached at all, as opposed to being reachable and not holding the
 * item.
 *
 * <p>The distinction matters. Treating an unreachable DSpace as "item not found" made {@code
 * sync:diff} report {@code CREATE_ITEM} for an item that may well exist, and made {@code
 * sync:apply} fail with a transport-level message that gave no hint about the actual cause. Both
 * now surface the endpoint and the command that starts it.
 */
public class DspaceUnavailableException extends IllegalStateException {
    public DspaceUnavailableException(String baseUrl, Throwable cause) {
        super(
                "DSpace is not reachable at " + baseUrl
                        + ". Start it with: pnpm run dspace:up (then pnpm run dspace:seed).",
                cause);
    }

    public DspaceUnavailableException(String baseUrl, int statusCode) {
        super("DSpace responded with HTTP " + statusCode + " at " + baseUrl
                + ". Check the dspace-rest container: pnpm run dspace:logs");
    }
}
