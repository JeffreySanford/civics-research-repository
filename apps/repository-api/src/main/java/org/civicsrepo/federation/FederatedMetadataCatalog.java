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

    /**
     * Counts retained metadata owned by one source system.
     *
     * <p>The default implementation preserves compatibility for in-memory/test catalogs by walking
     * the source's stable namespaced ID range. Production persistence may override this with a
     * direct aggregate query.
     */
    default long count(FederatedSourceSystem sourceSystem) {
        String sourcePrefix = sourceSystem.name() + ":";
        String cursor = sourcePrefix;
        long total = 0;
        while (true) {
            List<FederatedResearchRecord> page = findAfterId(cursor, 1_000);
            if (page.isEmpty()) {
                return total;
            }
            int sourceRecords = 0;
            for (FederatedResearchRecord record : page) {
                if (record.sourceSystem() != sourceSystem || !record.id().startsWith(sourcePrefix)) {
                    return total;
                }
                total++;
                sourceRecords++;
                cursor = record.id();
            }
            if (sourceRecords < page.size() || page.size() < 1_000) {
                return total;
            }
        }
    }
}
