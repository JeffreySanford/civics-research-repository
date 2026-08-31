package org.civicsrepo.federation;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;

/** Durable run ledger for resumable federated harvesting. */
public interface HarvestRunStore {
    void save(HarvestRun run);

    Optional<HarvestRun> findById(String id);

    Optional<HarvestRun> findResumable(FederatedSourceSystem sourceSystem);

    List<HarvestRun> findRecent(FederatedSourceSystem sourceSystem, int limit);

    /**
     * Marks the current resumable run terminal before a corpus archive replaces retained metadata.
     *
     * <p>The historical row remains reviewable, but it can no longer supply a cursor against a
     * different restored corpus.
     */
    default void cancelResumable(FederatedSourceSystem sourceSystem, OffsetDateTime completedAt) {
        findResumable(sourceSystem).ifPresent(run -> save(new HarvestRun(
                run.id(),
                run.sourceSystem(),
                run.adapterVersion(),
                HarvestRunStatus.CANCELLED,
                run.pageSize(),
                run.pageCount(),
                run.acceptedCount(),
                run.rejectedCount(),
                run.skippedCount(),
                run.cursor(),
                run.startedAt(),
                completedAt,
                completedAt,
                null)));
    }
}
