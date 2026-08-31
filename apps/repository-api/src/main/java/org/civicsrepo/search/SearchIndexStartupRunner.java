package org.civicsrepo.search;

import org.civicsrepo.admin.CorpusProfileActivationService;
import org.civicsrepo.federation.CorpusProfile;
import org.civicsrepo.sync.SyncProperties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

/**
 * Activates the quick-start discovery profile after startup sync has populated DSpace.
 *
 * <p>Ordered behind {@code StartupSyncRunner} so a freshly synchronized curated item is projected
 * in the same boot rather than on the next one. Startup deliberately resets the active search
 * profile to CURATED_DEMO; larger retained federated corpora remain in PostgreSQL until an operator
 * activates another named profile through Admin.
 */
@Component
@Order(20)
@EnableConfigurationProperties(SyncProperties.class)
public class SearchIndexStartupRunner implements CommandLineRunner {
    private static final Logger LOGGER = LoggerFactory.getLogger(SearchIndexStartupRunner.class);

    private final CorpusProfileActivationService activationService;
    private final SyncProperties syncProperties;

    public SearchIndexStartupRunner(
            CorpusProfileActivationService activationService,
            SyncProperties syncProperties) {
        this.activationService = activationService;
        this.syncProperties = syncProperties;
    }

    @Override
    public void run(String... args) {
        if (syncProperties.cliEnabled()) {
            LOGGER.info("Discovery projection is skipped because CLI sync is enabled.");
            return;
        }

        LOGGER.info("Activating CURATED_DEMO as the startup discovery profile.");
        activationService.activate(CorpusProfile.CURATED_DEMO);
    }
}
