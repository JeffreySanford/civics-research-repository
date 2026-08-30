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
 * the next invocation. A source-complete page marks the run COMPLETED. Exhausted transient publisher
 * failures also pause without advancing the checkpoint so the same run can resume later; permanent
 * publisher/schema failures remain terminal FAILED runs.
 *
 * <p>Cancellation is cooperative at page boundaries. Cancelling a run preserves the source
 * checkpoint so a later ordinary run can continue from the last durable page. Restarting from the
 * beginning is deliberately separate: it cancels any resumable run and clears the checkpoint before
 * starting a fresh run ID.
 */
@Service
public class FederatedHarvestRunService {
    private static final int MAX_PAGES_PER_INVOCATION = 100_000;

    private final FederatedHarvestService harvestService;
    private final HarvestRunStore runStore;
    private final HarvestCheckpointStore checkpointStore;
    private final Map<FederatedSourceSystem, FederatedSourceHarvester> harvesters;
    private final List<FederatedHarvestCompletionListener> completionListeners;
    private final Clock clock;

    @Autowired
    public FederatedHarvestRunService(
            FederatedHarvestService harvestService,
            HarvestRunStore runStore,
            HarvestCheckpointStore checkpointStore,
            List<FederatedSourceHarvester> harvesters,
            List<FederatedHarvestCompletionListener> completionListeners) {
        this(
                harvestService,
                runStore,
                checkpointStore,
                harvesters,
                completionListeners,
                Clock.systemUTC());
    }

    FederatedHarvestRunService(
            FederatedHarvestService harvestService,
            HarvestRunStore runStore,
            HarvestCheckpointStore checkpointStore,
            List<FederatedSourceHarvester> harvesters,
            Clock clock) {
        this(harvestService, runStore, checkpointStore, harvesters, List.of(), clock);
    }

    FederatedHarvestRunService(
            FederatedHarvestService harvestService,
            HarvestRunStore runStore,
            HarvestCheckpointStore checkpointStore,
            List<FederatedSourceHarvester> harvesters,
            List<FederatedHarvestCompletionListener> completionListeners,
            Clock clock) {
        this.harvestService = harvestService;
        this.runStore = runStore;
        this.checkpointStore = checkpointStore;
        this.completionListeners = List.copyOf(completionListeners);
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
        validateBounds(pageSize, maxPages);

        FederatedSourceHarvester harvester = requireHarvester(sourceSystem);
        String adapterVersion = harvester.adapterVersion();
        HarvestRun run = runStore.findResumable(sourceSystem)
                .map(existing -> resume(existing, pageSize, adapterVersion))
                .orElseGet(() -> start(sourceSystem, adapterVersion, pageSize));

        for (int page = 0; page < maxPages; page++) {
            HarvestRun current = current(run);
            if (current.status() == HarvestRunStatus.CANCELLED) {
                return current;
            }

            HarvestRun completedRun = null;
            try {
                FederatedHarvestService.HarvestResult result =
                        harvestService.harvestNext(sourceSystem, pageSize, run.id());
                OffsetDateTime now = now();

                // A cancellation request can arrive while a bounded source page is in flight. The
                // page itself is allowed to finish transactionally; cancellation takes effect before
                // the next page and the terminal run retains the progress that was just committed.
                HarvestRun afterPage = current(run);
                if (afterPage.status() == HarvestRunStatus.CANCELLED) {
                    HarvestRun cancelled = new HarvestRun(
                            run.id(),
                            run.sourceSystem(),
                            run.adapterVersion(),
                            HarvestRunStatus.CANCELLED,
                            run.pageSize(),
                            run.pageCount() + 1,
                            result.totalAccepted(),
                            run.rejectedCount() + result.rejectedThisPage(),
                            run.skippedCount(),
                            result.nextCursor(),
                            run.startedAt(),
                            now,
                            afterPage.completedAt() == null ? now : afterPage.completedAt(),
                            null);
                    runStore.save(cancelled);
                    return cancelled;
                }

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
                    completedRun = run;
                }
            } catch (FederatedHarvestException exception) {
                HarvestRun currentAfterFailure = current(run);
                if (currentAfterFailure.status() == HarvestRunStatus.CANCELLED) {
                    return currentAfterFailure;
                }

                OffsetDateTime now = now();
                if (exception.retryable()) {
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
                            now,
                            null,
                            failureMessage(exception));
                    runStore.save(paused);
                    return paused;
                }

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
            } catch (RuntimeException exception) {
                HarvestRun currentAfterFailure = current(run);
                if (currentAfterFailure.status() == HarvestRunStatus.CANCELLED) {
                    return currentAfterFailure;
                }

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

            if (completedRun != null) {
                notifyCompleted(completedRun);
                return completedRun;
            }
        }

        HarvestRun current = current(run);
        if (current.status() == HarvestRunStatus.CANCELLED) {
            return current;
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

    /**
     * Cancels the current resumable run but deliberately keeps the source checkpoint.
     *
     * <p>A later {@link #runBounded} call starts a new run ID and continues from that checkpoint.
     */
    public HarvestRun cancel(FederatedSourceSystem sourceSystem) {
        HarvestRun run = runStore.findResumable(sourceSystem)
                .orElseThrow(() -> new IllegalStateException("No resumable harvest run for " + sourceSystem));
        return cancelRun(run);
    }

    /**
     * Starts from source offset zero with a new run ID.
     *
     * <p>Any resumable run is marked CANCELLED first; then the source checkpoint is explicitly
     * cleared. This operation is intentionally different from ordinary resume-after-cancel.
     */
    public HarvestRun restartFromBeginning(FederatedSourceSystem sourceSystem, int pageSize, int maxPages) {
        validateBounds(pageSize, maxPages);
        requireHarvester(sourceSystem);
        runStore.findResumable(sourceSystem).ifPresent(this::cancelRun);
        checkpointStore.clear(sourceSystem);
        return runBounded(sourceSystem, pageSize, maxPages);
    }

    private HarvestRun start(FederatedSourceSystem sourceSystem, String adapterVersion, int pageSize) {
        OffsetDateTime startedAt = now();
        HarvestCheckpoint checkpoint = checkpointStore
                .find(sourceSystem)
                .orElseGet(() -> HarvestCheckpoint.initial(sourceSystem));
        HarvestRun run = new HarvestRun(
                UUID.randomUUID().toString(),
                sourceSystem,
                adapterVersion,
                HarvestRunStatus.RUNNING,
                pageSize,
                0,
                checkpoint.acceptedCount(),
                0,
                0,
                checkpoint.cursor(),
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

    private HarvestRun cancelRun(HarvestRun run) {
        OffsetDateTime cancelledAt = now();
        HarvestRun cancelled = new HarvestRun(
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
                cancelledAt,
                cancelledAt,
                null);
        runStore.save(cancelled);
        return cancelled;
    }

    private void notifyCompleted(HarvestRun run) {
        for (FederatedHarvestCompletionListener listener : completionListeners) {
            listener.onCompleted(run);
        }
    }

    private HarvestRun current(HarvestRun fallback) {
        return runStore.findById(fallback.id()).orElse(fallback);
    }

    private FederatedSourceHarvester requireHarvester(FederatedSourceSystem sourceSystem) {
        FederatedSourceHarvester harvester = harvesters.get(sourceSystem);
        if (harvester == null) {
            throw new IllegalArgumentException("No harvester registered for " + sourceSystem);
        }
        return harvester;
    }

    private void validateBounds(int pageSize, int maxPages) {
        if (pageSize < 1 || pageSize > 10_000) {
            throw new IllegalArgumentException("pageSize must be between 1 and 10000");
        }
        if (maxPages < 1 || maxPages > MAX_PAGES_PER_INVOCATION) {
            throw new IllegalArgumentException("maxPages must be between 1 and " + MAX_PAGES_PER_INVOCATION);
        }
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
