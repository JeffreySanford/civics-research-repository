package org.civicsrepo.repository;

import org.civicsrepo.generated.dto.SearchResult;
import org.civicsrepo.search.DiscoveryDocument;
import org.civicsrepo.generated.dto.RepositorySource;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.concurrent.atomic.AtomicReference;
import org.civicsrepo.search.SolrSearchClient;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * Builds the Solr discovery core from DSpace, and remembers what it built.
 *
 * <p>The discovery core is a projection: it must always be rebuildable from the repository, and
 * anything that exists only in Solr is a bug. This service is the only writer, so the answer to
 * "what is in the index right now" has exactly one owner.
 *
 * <p>When DSpace holds no items — unreachable, unseeded, or genuinely empty — the fixture catalog
 * is indexed instead so the demo still functions. That substitution is recorded and reported
 * through the API rather than left for someone to discover.
 */
@Service
public class DiscoveryProjectionService {
    private static final Logger LOGGER = LoggerFactory.getLogger(DiscoveryProjectionService.class);

    private final RepositoryCatalog repositoryCatalog;
    private final RepositoryIdentityStore repositoryIdentityStore;
    private final SolrSearchClient solrSearchClient;
    private final AtomicReference<ProjectionState> state =
            new AtomicReference<>(new ProjectionState(RepositorySource.FIXTURE, 0, null));

    public DiscoveryProjectionService(RepositoryCatalog repositoryCatalog, SolrSearchClient solrSearchClient, RepositoryIdentityStore repositoryIdentityStore) {
        this.repositoryIdentityStore = repositoryIdentityStore;
        this.repositoryCatalog = repositoryCatalog;
        this.solrSearchClient = solrSearchClient;
    }

    /** What the discovery index currently holds. */
    public ProjectionState state() {
        return state.get();
    }

    /** Source of the data currently searchable, used to label API responses. */
    public RepositorySource currentSource() {
        return state.get().source();
    }

    /**
     * Rebuilds the discovery index.
     *
     * @param fixtureFallback catalog to index when the repository yields nothing
     */
    public ProjectionState reindex(List<DiscoveryDocument> fixtureFallback) {
        // A rebuild is the point at which a stale repository read must not survive.
        repositoryCatalog.invalidate();
        List<DiscoveryDocument> repositoryObjects = repositoryCatalog.findAllDiscoveryDocuments();
        boolean repositoryBacked = !repositoryObjects.isEmpty();
        List<DiscoveryDocument> results = repositoryBacked ? repositoryObjects : fixtureFallback;
        RepositorySource source = repositoryBacked ? RepositorySource.REPOSITORY : RepositorySource.FIXTURE;

        if (solrSearchClient.isEnabled()) {
            try {
                solrSearchClient.indexResearchObjects(results);
            } catch (RuntimeException exception) {
                LOGGER.warn(
                        "Discovery indexing failed; in-memory search remains available: {}", exception.getMessage());
            }
        } else {
            LOGGER.info("Solr is disabled; discovery will answer from in-memory results.");
        }

        // Stamped after indexing, not before: an object is "indexed" once discovery could return it.
        repositoryIdentityStore.recordIndexed(
                results.stream().map((document) -> document.result().getId()).toList());

        ProjectionState projected = new ProjectionState(source, results.size(), OffsetDateTime.now());
        state.set(projected);

        if (repositoryBacked) {
            LOGGER.info("Discovery projection rebuilt from DSpace: {} repository research objects.", results.size());
        } else {
            LOGGER.warn(
                    "Discovery projection is serving {} FIXTURE research objects because the repository returned no"
                            + " items. Start DSpace and run pnpm run dspace:seed, then pnpm run reindex.",
                    results.size());
        }

        return projected;
    }

    /** Results currently searchable, so callers can answer without Solr when it is unavailable. */
    public List<SearchResult> repositoryObjects() {
        return repositoryCatalog.findAllResearchObjects();
    }

    public record ProjectionState(RepositorySource source, int objectCount, OffsetDateTime rebuiltAt) {}
}
