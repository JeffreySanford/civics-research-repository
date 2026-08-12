package org.civicsrepo.search;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.civicsrepo.sync.SyncProperties;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.stereotype.Component;

@Component
@EnableConfigurationProperties(SyncProperties.class)
public class SearchIndexStartupRunner implements CommandLineRunner {
    private static final Logger LOGGER = LoggerFactory.getLogger(SearchIndexStartupRunner.class);

    private final SearchService searchService;
    private final SolrSearchClient solrSearchClient;
    private final SyncProperties syncProperties;

    public SearchIndexStartupRunner(
            SearchService searchService, SolrSearchClient solrSearchClient, SyncProperties syncProperties) {
        this.searchService = searchService;
        this.solrSearchClient = solrSearchClient;
        this.syncProperties = syncProperties;
    }

    @Override
    public void run(String... args) {
        if (syncProperties.cliEnabled()) {
            LOGGER.info("Solr search indexing is skipped because CLI sync is enabled.");
            return;
        }

        if (!solrSearchClient.isEnabled()) {
            LOGGER.info("Solr search indexing is disabled.");
            return;
        }

        try {
            solrSearchClient.indexResearchObjects(searchService.seedResults());
            LOGGER.info(
                    "Indexed {} FIXTURE research objects into the Solr discovery core. These are generated"
                            + " placeholders, not DSpace repository metadata: discovery is not yet backed by the"
                            + " repository. See documentation/architecture-diagrams.md (Known Seams).",
                    searchService.seedResults().size());
        } catch (RuntimeException exception) {
            LOGGER.warn("Solr fixture indexing failed; in-memory search fallback remains available.", exception);
        }
    }
}
