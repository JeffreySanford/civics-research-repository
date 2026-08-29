package org.civicsrepo.repository;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.concurrent.atomic.AtomicReference;
import org.civicsrepo.generated.dto.RepositorySource;
import org.civicsrepo.generated.dto.SearchResult;
import org.civicsrepo.search.DiscoveryDocument;
import org.civicsrepo.search.DiscoveryProjectionTarget;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * Builds the public discovery projection from DSpace, and remembers what it built.
 *
 * <p>The projection is derived state: it must always be rebuildable from the repository, and
 * anything that exists only in a search engine is a bug. Every configured projection target gets
 * the same normalized document list from this service. Solr remains the live public search engine;
 * OpenSearch is a parallel comparison target until measured behavior justifies another decision.
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
    private final List<DiscoveryProjectionTarget> projectionTargets;
    private final AtomicReference<ProjectionState> state =
            new AtomicReference<>(new ProjectionState(RepositorySource.FIXTURE, 0, null));
    private final AtomicReference<String> projectionId = new AtomicReference<>();

    public DiscoveryProjectionService(
            RepositoryCatalog repositoryCatalog,
            List<DiscoveryProjectionTarget> projectionTargets,
            RepositoryIdentityStore repositoryIdentityStore) {
        this.repositoryIdentityStore = repositoryIdentityStore;
        this.repositoryCatalog = repositoryCatalog;
        this.projectionTargets = List.copyOf(projectionTargets);
    }

    /** What the discovery projection currently represents. */
    public ProjectionState state() {
        return state.get();
    }

    /**
     * Identity of the normalized document set used for the most recent projection.
     *
     * <p>The comparison API uses this to prove Solr and OpenSearch were handed identical normalized
     * inputs rather than inferring parity from matching document counts.
     */
    public String currentProjectionId() {
        return projectionId.get();
    }

    /** Source of the data currently searchable, used to label API responses. */
    public RepositorySource currentSource() {
        return state.get().source();
    }

    /**
     * Rebuilds every configured discovery projection target from one normalized document set.
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
        String projectedDocumentSetId = DiscoveryProjectionFingerprint.fingerprint(results);

        for (DiscoveryProjectionTarget target : projectionTargets) {
            if (!target.isEnabled()) {
                LOGGER.info("Discovery projection target {} is disabled.", target.indexName());
                continue;
            }

            try {
                target.indexResearchObjects(results);
                LOGGER.info(
                        "Discovery projection target {} rebuilt with {} objects.",
                        target.indexName(),
                        results.size());
            } catch (RuntimeException exception) {
                LOGGER.warn(
                        "Discovery projection target {} failed; other targets and in-memory search remain available: {}",
                        target.indexName(),
                        exception.getMessage());
            }
        }

        // Stamped after projection attempts, not before: an object is "indexed" once the public
        // projection process has run. Per-engine comparison status separately reports failed or
        // unavailable targets, so this identity record does not pretend every engine succeeded.
        repositoryIdentityStore.recordIndexed(
                results.stream().map((document) -> document.result().getId()).toList());

        ProjectionState projected = new ProjectionState(source, results.size(), OffsetDateTime.now());
        state.set(projected);
        projectionId.set(projectedDocumentSetId);

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

    /** Results currently searchable, so callers can answer without the configured index when it is unavailable. */
    public List<SearchResult> repositoryObjects() {
        return repositoryCatalog.findAllResearchObjects();
    }

    public record ProjectionState(RepositorySource source, int objectCount, OffsetDateTime rebuiltAt) {}
}
