package org.civicsrepo.search;

import org.civicsrepo.admin.CorpusProfileActivationService;
import org.civicsrepo.federation.CorpusProfile;
import org.civicsrepo.repository.DiscoveryProjectionService;
import org.civicsrepo.sync.SyncProperties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

/**
 * Ensures discovery has a usable search profile after startup sync has populated DSpace.
 *
 * <p>Ordered behind {@code StartupSyncRunner} so a fresh installation can still build the curated
 * quick-start projection in the same boot. Once an operator has durably activated another corpus
 * profile, ordinary application restart verifies the existing search targets and rehydrates runtime
 * projection identity without rewriting either derived index.
 */
@Component
@Order(20)
@EnableConfigurationProperties(SyncProperties.class)
public class SearchIndexStartupRunner implements CommandLineRunner {
    private static final Logger LOGGER = LoggerFactory.getLogger(SearchIndexStartupRunner.class);

    private final CorpusProfileActivationService activationService;
    private final DiscoveryProjectionService projectionService;
    private final SyncProperties syncProperties;

    public SearchIndexStartupRunner(
            CorpusProfileActivationService activationService,
            DiscoveryProjectionService projectionService,
            SyncProperties syncProperties) {
        this.activationService = activationService;
        this.projectionService = projectionService;
        this.syncProperties = syncProperties;
    }

    @Override
    public void run(String... args) {
        if (syncProperties.cliEnabled()) {
            LOGGER.info("Discovery projection is skipped because CLI sync is enabled.");
            return;
        }

        var persistedActivation = activationService.currentActivation();
        if (persistedActivation.isPresent()) {
            var activation = persistedActivation.orElseThrow();
            projectionService.rehydrate(activation);
            LOGGER.info(
                    "Preserved persisted discovery profile {} on projection {} ({} objects); startup verified existing search indexes without rebuilding them.",
                    activation.profile(),
                    activation.projectionId(),
                    activation.projectionObjectCount());
            return;
        }

        LOGGER.info("No persisted discovery activation exists; activating CURATED_DEMO for quick start.");
        activationService.activate(CorpusProfile.CURATED_DEMO);
    }
}
