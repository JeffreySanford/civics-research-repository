package org.civicsrepo.search;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

@Component
public class SearchIndexStartupRunner implements CommandLineRunner {
    private static final Logger LOGGER = LoggerFactory.getLogger(SearchIndexStartupRunner.class);

    private final SearchService searchService;
    private final SolrSearchClient solrSearchClient;

    public SearchIndexStartupRunner(SearchService searchService, SolrSearchClient solrSearchClient) {
        this.searchService = searchService;
        this.solrSearchClient = solrSearchClient;
    }

    @Override
    public void run(String... args) {
        if (!solrSearchClient.isEnabled()) {
            LOGGER.info("Solr search indexing is disabled.");
            return;
        }

        try {
            solrSearchClient.indexResearchObjects(searchService.seedResults());
            LOGGER.info("Indexed {} seed research objects into Solr.", searchService.seedResults().size());
        } catch (RuntimeException exception) {
            LOGGER.warn("Solr seed indexing failed; in-memory search fallback remains available.", exception);
        }
    }
}
