package org.civicsrepo.sync;

import org.civicsrepo.generated.dto.SyncJob;
import java.util.List;
import org.civicsrepo.generated.dto.SyncRequest;
import org.civicsrepo.generated.dto.SyncSource;
import org.civicsrepo.generated.dto.SyncStatus;
import org.civicsrepo.dspace.DspaceRestClient;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * Runs repository synchronization once at startup, but only when there is a DSpace to synchronize
 * with.
 *
 * <p>This used to run a DRY_RUN unconditionally, which logged seven {@code UPSERT_*} actions
 * against a DSpace that was not running in the default Compose profile. In a demo that reads as
 * repository work succeeding. Startup now applies real changes when DSpace is present and says
 * plainly why it did nothing when DSpace is absent.
 */
@Component
@EnableConfigurationProperties(SyncProperties.class)
public class StartupSyncRunner implements CommandLineRunner {
    private static final Logger LOGGER = LoggerFactory.getLogger(StartupSyncRunner.class);

    private final SyncProperties syncProperties;
    private final SyncService syncService;
    private final DspaceRestClient dspaceRestClient;

    public StartupSyncRunner(
            SyncProperties syncProperties, SyncService syncService, DspaceRestClient dspaceRestClient) {
        this.syncProperties = syncProperties;
        this.syncService = syncService;
        this.dspaceRestClient = dspaceRestClient;
    }

    @Override
    public void run(String... args) {
        if (syncProperties.cliEnabled()) {
            LOGGER.info("Startup sync is skipped because CLI sync is enabled.");
            return;
        }

        if (!syncProperties.startupEnabled()) {
            LOGGER.info("Startup sync is disabled.");
            return;
        }

        if (!dspaceRestClient.isReadEnabled()) {
            LOGGER.info(
                    "Startup sync skipped: no DSpace endpoint is configured. Set CIVICS_DSPACE_BASE_URL to enable"
                            + " repository synchronization.");
            return;
        }

        if (!dspaceRestClient.isReachable()) {
            LOGGER.info(
                    "Startup sync skipped: DSpace is not reachable at {}. The repository is untouched. Start it with:"
                            + " pnpm run dspace:up, then pnpm run dspace:seed.",
                    dspaceRestClient.baseUrl());
            return;
        }

        // Every source with an adapter, not just one. Startup used to sync `civics.sync.source`
        // alone, which is why one research object of 181 had a recorded DSpace identity while the
        // other four adapters sat unused. That property still selects the source for the admin and
        // CLI paths, where picking one is the point.
        List<SyncSource> sources = syncService.availableSources();
        if (sources.isEmpty()) {
            LOGGER.info("Startup sync skipped: no metadata adapters are registered.");
            return;
        }

        int succeeded = 0;
        for (SyncSource source : sources) {
            try {
                SyncJob job = syncService.runSync(new SyncRequest(syncProperties.mode(), source));
                LOGGER.info(
                        "Startup sync {} for {} completed with status {} in mode {}.",
                        job.getId(),
                        source.getValue(),
                        job.getStatus(),
                        job.getMode());
                // Counted by status, not by "did not throw". A FAILED job returns normally, so
                // the first version of this reported 5 of 5 while one source had not reconciled
                // at all -- a summary line that hid the thing it existed to surface.
                if (job.getStatus() == SyncStatus.APPLIED || job.getStatus() == SyncStatus.DRY_RUN_COMPLETE) {
                    succeeded++;
                }
            } catch (RuntimeException exception) {
                // One source failing must not stop the rest. A publisher being unreachable is a
                // fact about that publisher, not a reason to leave four other sources unreconciled.
                LOGGER.warn(
                        "Startup sync for {} failed: {}. Other sources continue.",
                        source.getValue(),
                        exception.getMessage());
            }
        }

        LOGGER.info(
                "Startup sync reconciled {} of {} sources against {}.",
                succeeded,
                sources.size(),
                dspaceRestClient.baseUrl());
    }
}
