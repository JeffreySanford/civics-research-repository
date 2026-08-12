package org.civicsrepo.sync;

import org.civicsrepo.generated.dto.SyncJob;
import org.civicsrepo.generated.dto.SyncRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

@Component
@Order(0)
@EnableConfigurationProperties(SyncProperties.class)
public class CliSyncRunner implements CommandLineRunner {
    private static final Logger LOGGER = LoggerFactory.getLogger(CliSyncRunner.class);

    private final ConfigurableApplicationContext applicationContext;
    private final SyncProperties syncProperties;
    private final SyncService syncService;

    public CliSyncRunner(
            ConfigurableApplicationContext applicationContext, SyncProperties syncProperties, SyncService syncService) {
        this.applicationContext = applicationContext;
        this.syncProperties = syncProperties;
        this.syncService = syncService;
    }

    @Override
    public void run(String... args) {
        if (!syncProperties.cliEnabled()) {
            return;
        }

        SyncJob job = syncService.runSync(new SyncRequest(syncProperties.mode(), syncProperties.source()));
        LOGGER.info(
                "CLI sync {} completed with status {} for source {} in mode {}.",
                job.getId(),
                job.getStatus(),
                job.getSource(),
                job.getMode());

        applicationContext.close();
    }
}
