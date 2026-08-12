package org.civicsrepo.sync;

import org.civicsrepo.generated.dto.SyncJob;
import org.civicsrepo.generated.dto.SyncRequest;
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

        SyncJob job = syncService.runSync(new SyncRequest(syncProperties.mode(), syncProperties.source()));
        LOGGER.info(
                "Startup sync {} completed with status {} in mode {} against {}.",
                job.getId(),
                job.getStatus(),
                job.getMode(),
                dspaceRestClient.baseUrl());
    }
}
