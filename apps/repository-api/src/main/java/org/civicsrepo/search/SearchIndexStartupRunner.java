package org.civicsrepo.search;

import org.civicsrepo.repository.DiscoveryProjectionService;
import org.civicsrepo.sync.SyncProperties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

/**
 * Builds the discovery projection at startup, after sync has had a chance to populate DSpace.
 *
 * <p>Ordered behind {@code StartupSyncRunner} so a freshly synchronized item is projected in the
 * same boot rather than on the next one.
 */
@Component
@Order(20)
@EnableConfigurationProperties(SyncProperties.class)
public class SearchIndexStartupRunner implements CommandLineRunner {
    private static final Logger LOGGER = LoggerFactory.getLogger(SearchIndexStartupRunner.class);

    private final SearchService searchService;
    private final DiscoveryProjectionService discoveryProjectionService;
    private final SyncProperties syncProperties;

    public SearchIndexStartupRunner(
            SearchService searchService,
            DiscoveryProjectionService discoveryProjectionService,
            SyncProperties syncProperties) {
        this.searchService = searchService;
        this.discoveryProjectionService = discoveryProjectionService;
        this.syncProperties = syncProperties;
    }

    @Override
    public void run(String... args) {
        if (syncProperties.cliEnabled()) {
            LOGGER.info("Discovery projection is skipped because CLI sync is enabled.");
            return;
        }

        discoveryProjectionService.reindex(searchService.fixtureDocuments());
    }
}
