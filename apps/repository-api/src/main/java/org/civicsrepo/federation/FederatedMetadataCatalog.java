package org.civicsrepo.federation;

import java.util.List;
import java.util.Optional;

/** Authoritative local metadata catalog for externally owned research records. */
public interface FederatedMetadataCatalog {
    void upsertBatch(List<FederatedResearchRecord> records);

    Optional<FederatedResearchRecord> findById(String id);

    /**
     * Returns the next deterministic page after a stable namespaced identifier.
     *
     * <p>This intentionally avoids offset pagination so projection work remains efficient when the
     * catalog reaches hundreds of thousands or millions of records.
     */
    List<FederatedResearchRecord> findAfterId(String afterId, int limit);

    long count();
}
