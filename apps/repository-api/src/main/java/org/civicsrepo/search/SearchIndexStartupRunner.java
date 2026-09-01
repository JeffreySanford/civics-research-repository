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
 * Ensures discovery has a usable search profile after startup sync has populated DSpace.
 *
 * <p>Ordered behind {@code StartupSyncRunner} so a fresh installation can still build the curated
 * quick-start projection in the same boot. Once an operator has durably activated another corpus
 * profile, ordinary application restart preserves that activation and leaves the existing derived
 * search indexes untouched rather than silently replacing them with CURATED_DEMO.
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

        var persistedActivation = activationService.currentActivation();
        if (persistedActivation.isPresent()) {
            var activation = persistedActivation.orElseThrow();
            LOGGER.info(
                    "Preserving persisted discovery profile {} on projection {} ({} objects); startup will not rebuild search indexes.",
                    activation.profile(),
                    activation.projectionId(),
                    activation.projectionObjectCount());
            return;
        }

        LOGGER.info("No persisted discovery activation exists; activating CURATED_DEMO for quick start.");
        activationService.activate(CorpusProfile.CURATED_DEMO);
    }
}
