package org.civicsrepo.federation;

import java.time.OffsetDateTime;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;

/** Coordinates one bounded, resumable harvest page at a time. */
@Service
public class FederatedHarvestService {
    private final FederatedMetadataCatalog catalog;
    private final HarvestCheckpointStore checkpointStore;
    private final Map<FederatedSourceSystem, FederatedSourceHarvester> harvesters;

    public FederatedHarvestService(
            FederatedMetadataCatalog catalog,
            HarvestCheckpointStore checkpointStore,
            List<FederatedSourceHarvester> harvesters) {
        this.catalog = catalog;
        this.checkpointStore = checkpointStore;
        this.harvesters = new EnumMap<>(FederatedSourceSystem.class);
        for (FederatedSourceHarvester harvester : harvesters) {
            FederatedSourceHarvester previous = this.harvesters.put(harvester.sourceSystem(), harvester);
            if (previous != null) {
                throw new IllegalArgumentException("Duplicate harvester for " + harvester.sourceSystem());
            }
        }
    }

    public HarvestResult harvestNext(FederatedSourceSystem sourceSystem, int pageSize) {
        if (pageSize < 1 || pageSize > 10_000) {
            throw new IllegalArgumentException("pageSize must be between 1 and 10000");
        }

        FederatedSourceHarvester harvester = harvesters.get(sourceSystem);
        if (harvester == null) {
            throw new IllegalArgumentException("No harvester registered for " + sourceSystem);
        }

        HarvestCheckpoint checkpoint = checkpointStore
                .find(sourceSystem)
                .orElseGet(() -> HarvestCheckpoint.initial(sourceSystem));
        HarvestPage page = harvester.fetch(checkpoint.cursor(), pageSize);

        for (FederatedResearchRecord record : page.records()) {
            if (record.sourceSystem() != sourceSystem) {
                throw new IllegalStateException(
                        "Harvester " + sourceSystem + " returned record owned by " + record.sourceSystem());
            }
        }

        catalog.upsertBatch(page.records());
        long totalAccepted = checkpoint.acceptedCount() + page.records().size();

        if (page.complete()) {
            checkpointStore.clear(sourceSystem);
        } else {
            checkpointStore.save(
                    new HarvestCheckpoint(sourceSystem, page.nextCursor(), totalAccepted, OffsetDateTime.now()));
        }

        return new HarvestResult(
                sourceSystem,
                page.records().size(),
                totalAccepted,
                page.complete(),
                page.complete() ? null : page.nextCursor());
    }

    public record HarvestResult(
            FederatedSourceSystem sourceSystem,
            int acceptedThisPage,
            long totalAccepted,
            boolean complete,
            String nextCursor) {}
}
