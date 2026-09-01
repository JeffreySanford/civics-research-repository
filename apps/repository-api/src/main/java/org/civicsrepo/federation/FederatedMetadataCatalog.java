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

    /**
     * Returns one source-owned deterministic page after a stable namespaced identifier.
     *
     * <p>Archive and composite-corpus workflows use this to stream exact source slices without
     * materializing the complete retained federation in memory.
     */
    default List<FederatedResearchRecord> findSourceAfterId(
            FederatedSourceSystem sourceSystem, String afterId, int limit) {
        String sourcePrefix = sourceSystem.name() + ":";
        String cursor = afterId == null || afterId.isBlank() ? sourcePrefix : afterId;
        return findAfterId(cursor, limit).stream()
                .takeWhile(record -> record.sourceSystem() == sourceSystem && record.id().startsWith(sourcePrefix))
                .toList();
    }

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
            List<FederatedResearchRecord> page = findSourceAfterId(sourceSystem, cursor, 1_000);
            if (page.isEmpty()) {
                return total;
            }
            for (FederatedResearchRecord record : page) {
                total++;
                cursor = record.id();
            }
            if (page.size() < 1_000) {
                return total;
            }
        }
    }

    /**
     * Clears retained federated metadata before an explicitly confirmed archive replacement.
     *
     * <p>Production persistence overrides this operation. Test catalogs that do not model restore
     * can keep the default failure so destructive behavior is never silently emulated.
     */
    default void deleteAll() {
        throw new UnsupportedOperationException("Federated metadata replacement is not supported by this catalog");
    }
}
