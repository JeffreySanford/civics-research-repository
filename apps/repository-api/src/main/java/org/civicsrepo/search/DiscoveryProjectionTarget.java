package org.civicsrepo.search;

import java.util.List;
import java.util.Optional;

/**
 * A rebuildable destination for the normalized public discovery projection.
 *
 * <p>DSpace remains authoritative. A target can be deleted and reconstructed from the same
 * {@link DiscoveryDocument} set at any time. Solr implements this through {@link DiscoveryIndex};
 * OpenSearch implements only this projection boundary until comparison querying is enabled.
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

    /**
     * Replaces this target with the supplied normalized documents.
     *
     * <p>A replace rather than a merge is deliberate: a discovery target has no authority of its
     * own and must not retain an object DSpace no longer contains.
     */
    void indexResearchObjects(List<DiscoveryDocument> objects);
}
