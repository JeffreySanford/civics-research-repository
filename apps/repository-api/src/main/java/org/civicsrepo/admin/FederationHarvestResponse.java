package org.civicsrepo.admin;

import java.time.OffsetDateTime;
import org.civicsrepo.federation.FederatedSourceSystem;
import org.civicsrepo.federation.HarvestRun;
import org.civicsrepo.federation.HarvestRunStatus;

/** Durable bounded-harvest evidence returned to the local operator. */
public record FederationHarvestResponse(
        String runId,
        FederatedSourceSystem sourceSystem,
        String adapterVersion,
        HarvestRunStatus status,
        int pageSize,
        int pageCount,
        long acceptedCount,
        long rejectedCount,
        long skippedCount,
        String cursor,
        OffsetDateTime startedAt,
        OffsetDateTime updatedAt,
        OffsetDateTime completedAt,
        String failureMessage,
        boolean projectionRefreshRequired) {

    static FederationHarvestResponse from(HarvestRun run) {
        return new FederationHarvestResponse(
                run.id(),
                run.sourceSystem(),
                run.adapterVersion(),
                run.status(),
                run.pageSize(),
                run.pageCount(),
                run.acceptedCount(),
                run.rejectedCount(),
                run.skippedCount(),
                run.cursor(),
                run.startedAt(),
                run.updatedAt(),
                run.completedAt(),
                run.failureMessage(),
                run.acceptedCount() > 0);
    }
}
