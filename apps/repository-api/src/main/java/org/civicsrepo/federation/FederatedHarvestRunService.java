package org.civicsrepo.federation;

import java.time.Clock;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

/**
 * Wraps page-level harvesting in a durable, bounded run lifecycle.
 *
 * <p>A caller chooses how many pages may execute in one invocation. Hitting that operator bound is
 * a PAUSED run, not a success or failure; the persisted source checkpoint and run ID are reused on
 * the next invocation. A source-complete page marks the run COMPLETED. Exhausted retries or any
 * other page failure marks it FAILED without advancing the checkpoint.
 */
@Service
public class FederatedHarvestRunService {
    private static final int MAX_PAGES_PER_INVOCATION = 100_000;

    private final FederatedHarvestService harvestService;
    private final HarvestRunStore runStore;
    private final Map<FederatedSourceSystem, FederatedSourceHarvester> harvesters;
    private final Clock clock;

    @Autowired
    public FederatedHarvestRunService(
            FederatedHarvestService harvestService,
            HarvestRunStore runStore,
            List<FederatedSourceHarvester> harvesters) {
        this(harvestService, runStore, harvesters, Clock.systemUTC());
    }

    FederatedHarvestRunService(
            FederatedHarvestService harvestService,
            HarvestRunStore runStore,
            List<FederatedSourceHarvester> harvesters,
            Clock clock) {
        this.harvestService = harvestService;
        this.runStore = runStore;
        this.clock = clock;
        this.harvesters = new EnumMap<>(FederatedSourceSystem.class);
        for (FederatedSourceHarvester harvester : harvesters) {
            FederatedSourceHarvester previous = this.harvesters.put(harvester.sourceSystem(), harvester);
            if (previous != null) {
                throw new IllegalArgumentException("Duplicate harvester for " + harvester.sourceSystem());
            }
        }
    }

    public HarvestRun runBounded(FederatedSourceSystem sourceSystem, int pageSize, int maxPages) {
        if (pageSize < 1 || pageSize > 10_000) {
            throw new IllegalArgumentException("pageSize must be between 1 and 10000");
        }
        if (maxPages < 1 || maxPages > MAX_PAGES_PER_INVOCATION) {
            throw new IllegalArgumentException("maxPages must be between 1 and " + MAX_PAGES_PER_INVOCATION);
        }

        FederatedSourceHarvester harvester = harvesters.get(sourceSystem);
        if (harvester == null) {
            throw new IllegalArgumentException("No harvester registered for " + sourceSystem);
        }

        String adapterVersion = harvester.adapterVersion();
        HarvestRun run = runStore.findResumable(sourceSystem)
                .map(existing -> resume(existing, pageSize, adapterVersion))
                .orElseGet(() -> start(sourceSystem, adapterVersion, pageSize));

        for (int page = 0; page < maxPages; page++) {
            try {
                FederatedHarvestService.HarvestResult result =
                        harvestService.harvestNext(sourceSystem, pageSize, run.id());
                OffsetDateTime now = now();
                run = new HarvestRun(
                        run.id(),
                        run.sourceSystem(),
                        run.adapterVersion(),
                        result.complete() ? HarvestRunStatus.COMPLETED : HarvestRunStatus.RUNNING,
                        run.pageSize(),
                        run.pageCount() + 1,
                        result.totalAccepted(),
                        run.rejectedCount() + result.rejectedThisPage(),
                        run.skippedCount(),
                        result.nextCursor(),
                        run.startedAt(),
                        now,
                        result.complete() ? now : null,
                        null);
                runStore.save(run);
                if (result.complete()) {
                    return run;
                }
            } catch (RuntimeException exception) {
                OffsetDateTime now = now();
                HarvestRun failed = new HarvestRun(
                        run.id(),
                        run.sourceSystem(),
                        run.adapterVersion(),
                        HarvestRunStatus.FAILED,
                        run.pageSize(),
                        run.pageCount(),
                        run.acceptedCount(),
                        run.rejectedCount(),
                        run.skippedCount(),
                        run.cursor(),
                        run.startedAt(),
                        now,
                        now,
                        failureMessage(exception));
                runStore.save(failed);
                throw exception;
            }
        }

        OffsetDateTime pausedAt = now();
        HarvestRun paused = new HarvestRun(
                run.id(),
                run.sourceSystem(),
                run.adapterVersion(),
                HarvestRunStatus.PAUSED,
                run.pageSize(),
                run.pageCount(),
                run.acceptedCount(),
                run.rejectedCount(),
                run.skippedCount(),
                run.cursor(),
                run.startedAt(),
                pausedAt,
                null,
                null);
        runStore.save(paused);
        return paused;
    }

    private HarvestRun start(FederatedSourceSystem sourceSystem, String adapterVersion, int pageSize) {
        OffsetDateTime startedAt = now();
        HarvestRun run = new HarvestRun(
                UUID.randomUUID().toString(),
                sourceSystem,
                adapterVersion,
                HarvestRunStatus.RUNNING,
                pageSize,
                0,
                0,
                0,
                0,
                null,
                startedAt,
                startedAt,
                null,
                null);
        runStore.save(run);
        return run;
    }

    private HarvestRun resume(HarvestRun run, int pageSize, String adapterVersion) {
        if (run.pageSize() != pageSize) {
            throw new IllegalStateException(
                    "Harvest run " + run.id() + " must resume with pageSize " + run.pageSize());
        }
        if (!run.adapterVersion().equals(adapterVersion)) {
            throw new IllegalStateException(
                    "Harvest run " + run.id() + " was created with adapter " + run.adapterVersion()
                            + " and cannot resume with " + adapterVersion);
        }
        OffsetDateTime resumedAt = now();
        HarvestRun resumed = new HarvestRun(
                run.id(),
                run.sourceSystem(),
                run.adapterVersion(),
                HarvestRunStatus.RUNNING,
                run.pageSize(),
                run.pageCount(),
                run.acceptedCount(),
                run.rejectedCount(),
                run.skippedCount(),
                run.cursor(),
                run.startedAt(),
                resumedAt,
                null,
                null);
        runStore.save(resumed);
        return resumed;
    }

    private String failureMessage(RuntimeException exception) {
        String message = exception.getMessage();
        if (message == null || message.isBlank()) {
            return exception.getClass().getSimpleName();
        }
        return message.length() <= 4_000 ? message : message.substring(0, 4_000);
    }

    private OffsetDateTime now() {
        return OffsetDateTime.ofInstant(clock.instant(), ZoneOffset.UTC);
    }
}
