package org.civicsrepo.dspace;

/**
 * Raised when DSpace discovery returns more than one plausible target for a source identifier.
 *
 * <p>Reconciliation refuses to guess: writing to the wrong item would silently overwrite a sibling
 * research object's metadata, which is far worse than failing the sync job.
 */
public class AmbiguousDspaceItemException extends IllegalStateException {
    public AmbiguousDspaceItemException(String message) {
        super(message);
    }
}
