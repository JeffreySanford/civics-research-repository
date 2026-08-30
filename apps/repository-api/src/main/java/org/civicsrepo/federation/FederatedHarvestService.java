package org.civicsrepo.federation;

import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ThreadLocalRandom;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

/** Coordinates one bounded, resumable harvest page at a time. */
@Service
public class FederatedHarvestService {
    private static final int MAX_FETCH_ATTEMPTS = 3;
    private static final Duration BASE_RETRY_DELAY = Duration.ofMillis(250);
    private static final Duration MAX_RETRY_DELAY = Duration.ofSeconds(5);

    private final FederatedMetadataCatalog catalog;
    private final HarvestCheckpointStore checkpointStore;
    private final Map<FederatedSourceSystem, FederatedSourceHarvester> harvesters;
    private final HarvestSleeper sleeper;
    private final JitterSource jitterSource;

    @Autowired
    public FederatedHarvestService(
            FederatedMetadataCatalog catalog,
            HarvestCheckpointStore checkpointStore,
            List<FederatedSourceHarvester> harvesters) {
        this(
                catalog,
                checkpointStore,
                harvesters,
                (duration) -> Thread.sleep(duration.toMillis()),
                () -> ThreadLocalRandom.current().nextDouble(0.75, 1.25));
    }

    FederatedHarvestService(
            FederatedMetadataCatalog catalog,
            HarvestCheckpointStore checkpointStore,
            List<FederatedSourceHarvester> harvesters,
            HarvestSleeper sleeper,
            JitterSource jitterSource) {
        this.catalog = catalog;
        this.checkpointStore = checkpointStore;
        this.sleeper = sleeper;
        this.jitterSource = jitterSource;
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
        HarvestPage page = fetchWithRetry(harvester, checkpoint.cursor(), pageSize);

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

    private HarvestPage fetchWithRetry(FederatedSourceHarvester harvester, String cursor, int pageSize) {
        for (int attempt = 1; attempt <= MAX_FETCH_ATTEMPTS; attempt++) {
            try {
                return harvester.fetch(cursor, pageSize);
            } catch (FederatedHarvestException exception) {
                if (!exception.retryable() || attempt == MAX_FETCH_ATTEMPTS) {
                    throw exception;
                }
                sleepBeforeRetry(attempt, exception.retryAfter());
            }
        }
        throw new IllegalStateException("Retry loop exited without returning or throwing.");
    }

    private void sleepBeforeRetry(int failedAttempt, Duration retryAfter) {
        Duration exponential = BASE_RETRY_DELAY.multipliedBy(1L << Math.max(0, failedAttempt - 1));
        Duration bounded = exponential.compareTo(MAX_RETRY_DELAY) > 0 ? MAX_RETRY_DELAY : exponential;
        double jitter = Math.max(0.5, Math.min(1.5, jitterSource.multiplier()));
        Duration jittered = Duration.ofMillis(Math.max(1L, Math.round(bounded.toMillis() * jitter)));
        Duration selected = retryAfter != null && retryAfter.compareTo(jittered) > 0 ? retryAfter : jittered;
        Duration delay = selected.compareTo(MAX_RETRY_DELAY) > 0 ? MAX_RETRY_DELAY : selected;

        try {
            sleeper.sleep(delay);
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("Federated harvest retry interrupted.", exception);
        }
    }

    @FunctionalInterface
    interface HarvestSleeper {
        void sleep(Duration duration) throws InterruptedException;
    }

    @FunctionalInterface
    interface JitterSource {
        double multiplier();
    }

    public record HarvestResult(
            FederatedSourceSystem sourceSystem,
            int acceptedThisPage,
            long totalAccepted,
            boolean complete,
            String nextCursor) {}
}
