package org.civicsrepo.search;

import java.util.List;
import java.util.Optional;

/**
 * A rebuildable destination for the normalized public discovery projection.
 *
 * <p>DSpace and federated publisher metadata remain authoritative. A target can be reconstructed
 * from the same normalized discovery sequence at any time. The lifecycle is explicitly batched so
 * PI-1 can project 100K/1M corpora without creating one corpus-sized Java list or HTTP request.
 */
public interface DiscoveryProjectionTarget {

    /** Whether this projection target is configured. */
    boolean isEnabled();

    /** Whether the configured engine answers a liveness probe. */
    boolean isReachable();

    String baseUrl();

    /** Engine-neutral name for the core/index receiving the projection. */
    String indexName();

    /** Documents currently projected into this target, when readable. */
    Optional<Integer> documentCount();

    /** Prepare a replacement projection before the first bounded batch is sent. */
    void beginProjection();

    /** Add one ordered bounded batch to the replacement projection. */
    void indexBatch(List<DiscoveryDocument> objects);

    /** Publish/commit the replacement after every batch has succeeded. */
    void completeProjection();

    /** Discard or isolate an incomplete replacement as far as the engine supports. */
    void abortProjection();

    /**
     * Compatibility helper for small callers and tests. Production large-corpus projection should
     * drive the lifecycle a batch at a time rather than calling this method with a corpus-sized list.
     */
    default void indexResearchObjects(List<DiscoveryDocument> objects) {
        beginProjection();
        try {
            indexBatch(objects == null ? List.of() : objects);
            completeProjection();
        } catch (RuntimeException exception) {
            try {
                abortProjection();
            } catch (RuntimeException abortFailure) {
                exception.addSuppressed(abortFailure);
            }
            throw exception;
        }
    }
}
