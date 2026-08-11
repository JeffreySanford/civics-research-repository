package org.civicsrepo.sync;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.stereotype.Component;

@Component
@EnableConfigurationProperties(SyncProperties.class)
public class StartupSyncRunner implements CommandLineRunner {
    private static final Logger LOGGER = LoggerFactory.getLogger(StartupSyncRunner.class);

    private final SyncProperties syncProperties;
    private final SyncService syncService;

    public StartupSyncRunner(SyncProperties syncProperties, SyncService syncService) {
        this.syncProperties = syncProperties;
        this.syncService = syncService;
    }

    @Override
    public void run(String... args) {
        if (!syncProperties.startupEnabled()) {
            LOGGER.info("Startup sync is disabled.");
            return;
        }

        SyncJob job = syncService.runSync(new SyncRequest(syncProperties.mode(), syncProperties.source()));
        LOGGER.info("Startup sync {} completed with status {}.", job.id(), job.status());
    }
}
