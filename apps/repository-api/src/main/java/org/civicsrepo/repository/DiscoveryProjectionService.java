package org.civicsrepo.repository;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicReference;
import org.civicsrepo.federation.CombinedDiscoveryCatalog;
import org.civicsrepo.federation.CombinedDiscoveryCatalog.DiscoveryCursor;
import org.civicsrepo.federation.CombinedDiscoveryCatalog.DiscoveryPage;
import org.civicsrepo.generated.dto.RepositorySource;
import org.civicsrepo.generated.dto.ResearchObjectOrigin;
import org.civicsrepo.generated.dto.SearchResult;
import org.civicsrepo.search.DiscoveryDocument;
import org.civicsrepo.search.DiscoveryProjectionTarget;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * Builds the public discovery projection from authoritative repository/federated metadata and
 * remembers what it built.
 *
 * <p>PI-1 projection is bounded-memory: one canonical page is normalized once, added to a streaming
 * digest and handed unchanged to every active target. Solr remains the normal public search engine;
 * OpenSearch remains a parallel comparison target until evidence justifies another routing decision.
 *
 * <p>When neither DSpace nor the federated metadata catalog contains records, the small fixture
 * catalog is projected instead so the demo still functions. That substitution remains explicitly
 * labelled through the compatibility {@link RepositorySource} field and per-result provenance.
 */
@Service
public class DiscoveryProjectionService {
    private static final Logger LOGGER = LoggerFactory.getLogger(DiscoveryProjectionService.class);
    private static final int PROJECTION_BATCH_SIZE = 1_000;

    private final RepositoryCatalog repositoryCatalog;
    private final CombinedDiscoveryCatalog combinedDiscoveryCatalog;
    private final RepositoryIdentityStore repositoryIdentityStore;
    private final List<DiscoveryProjectionTarget> projectionTargets;
    private final AtomicReference<ProjectionState> state =
            new AtomicReference<>(new ProjectionState(RepositorySource.FIXTURE, 0, null));
    private final AtomicReference<String> projectionId = new AtomicReference<>();
    private final AtomicReference<Map<String, ProjectionTargetState>> targetStates =
            new AtomicReference<>(Map.of());

    public DiscoveryProjectionService(
            RepositoryCatalog repositoryCatalog,
            CombinedDiscoveryCatalog combinedDiscoveryCatalog,
            List<DiscoveryProjectionTarget> projectionTargets,
            RepositoryIdentityStore repositoryIdentityStore) {
        this.repositoryCatalog = repositoryCatalog;
        this.combinedDiscoveryCatalog = combinedDiscoveryCatalog;
        this.repositoryIdentityStore = repositoryIdentityStore;
        this.projectionTargets = List.copyOf(projectionTargets);
    }

    /** What the discovery projection currently represents. */
    public ProjectionState state() {
        return state.get();
    }

    /** Identity of the normalized document sequence used for the most recent projection. */
    public String currentProjectionId() {
        return projectionId.get();
    }

    /** Per-target outcome of the most recent projection attempt. */
    public ProjectionTargetState targetState(String indexName) {
        return targetStates.get().get(indexName);
    }

    /** Source of the data currently searchable, used to label compatibility-level API responses. */
    public RepositorySource currentSource() {
        return state.get().source();
    }

    /**
     * Rebuilds every configured discovery projection target from one bounded canonical sequence.
     *
     * @param fixtureFallback small fallback catalog to index only when no authoritative records exist
     */
    public ProjectionState reindex(List<DiscoveryDocument> fixtureFallback) {
        repositoryCatalog.invalidate();
        List<DiscoveryDocument> repositoryObjects = repositoryCatalog.findAllDiscoveryDocuments();
        long federatedCount = combinedDiscoveryCatalog.retainedFederatedCount();
        boolean authorityBacked = !repositoryObjects.isEmpty() || federatedCount > 0;
        RepositorySource source = authorityBacked ? RepositorySource.REPOSITORY : RepositorySource.FIXTURE;

        Map<String, ProjectionTargetState> projectedTargets = new LinkedHashMap<>();
        List<DiscoveryProjectionTarget> activeTargets = beginTargets(projectedTargets);
        DiscoveryProjectionDigest digest = new DiscoveryProjectionDigest();
        List<String> indexedRepositoryIds = new ArrayList<>();

        if (authorityBacked) {
            projectCombined(activeTargets, projectedTargets, digest, indexedRepositoryIds);
        } else {
            projectFixtures(
                    fixtureFallback == null ? List.of() : fixtureFallback,
                    activeTargets,
                    projectedTargets,
                    digest);
        }

        String projectedDocumentSetId = digest.finish();
        finishTargets(activeTargets, projectedTargets, projectedDocumentSetId);

        if (!indexedRepositoryIds.isEmpty()) {
            repositoryIdentityStore.recordIndexed(List.copyOf(indexedRepositoryIds));
        }

        int projectedCount = Math.toIntExact(digest.documentCount());
        ProjectionState projected = new ProjectionState(source, projectedCount, OffsetDateTime.now());
        state.set(projected);
        projectionId.set(projectedDocumentSetId);
        targetStates.set(Map.copyOf(projectedTargets));

        if (authorityBacked) {
            LOGGER.info(
                    "Discovery projection rebuilt from authoritative metadata: {} objects ({} DSpace, {} retained federated).",
                    projectedCount,
                    repositoryObjects.size(),
                    federatedCount);
        } else {
            LOGGER.warn(
                    "Discovery projection is serving {} FIXTURE research objects because DSpace and the federated"
                            + " catalog returned no authoritative records.",
                    projectedCount);
        }

        return projected;
    }

    private List<DiscoveryProjectionTarget> beginTargets(
            Map<String, ProjectionTargetState> projectedTargets) {
        List<DiscoveryProjectionTarget> activeTargets = new ArrayList<>();
        for (DiscoveryProjectionTarget target : projectionTargets) {
            if (!target.isEnabled()) {
                projectedTargets.put(
                        target.indexName(),
                        new ProjectionTargetState(target.indexName(), false, false, null, null, "Target is disabled."));
                LOGGER.info("Discovery projection target {} is disabled.", target.indexName());
                continue;
            }

            try {
                target.beginProjection();
                activeTargets.add(target);
            } catch (RuntimeException exception) {
                abortQuietly(target, exception);
                projectedTargets.put(
                        target.indexName(),
                        new ProjectionTargetState(
                                target.indexName(),
                                true,
                                false,
                                null,
                                target.documentCount().orElse(null),
                                exception.getMessage()));
                LOGGER.warn("Discovery projection target {} could not begin: {}", target.indexName(), exception.getMessage());
            }
        }
        return activeTargets;
    }

    private void projectCombined(
            List<DiscoveryProjectionTarget> activeTargets,
            Map<String, ProjectionTargetState> projectedTargets,
            DiscoveryProjectionDigest digest,
            List<String> indexedRepositoryIds) {
        DiscoveryCursor cursor = null;
        boolean complete = false;
        while (!complete) {
            DiscoveryPage page = combinedDiscoveryCatalog.findAfter(cursor, PROJECTION_BATCH_SIZE);
            List<DiscoveryDocument> documents = page.documents();
            digest.updateBatch(documents);
            documents.stream()
                    .filter((document) -> document.result().getOrigin() == ResearchObjectOrigin.REPOSITORY)
                    .map((document) -> document.result().getId())
                    .forEach(indexedRepositoryIds::add);
            projectBatch(documents, activeTargets, projectedTargets);
            complete = page.complete();
            cursor = page.nextCursor();
        }
    }

    private void projectFixtures(
            List<DiscoveryDocument> fixtureFallback,
            List<DiscoveryProjectionTarget> activeTargets,
            Map<String, ProjectionTargetState> projectedTargets,
            DiscoveryProjectionDigest digest) {
        List<DiscoveryDocument> fixtures = fixtureFallback.stream()
                .sorted(Comparator.comparing((document) -> document.result().getId()))
                .toList();
        for (int from = 0; from < fixtures.size(); from += PROJECTION_BATCH_SIZE) {
            int to = Math.min(from + PROJECTION_BATCH_SIZE, fixtures.size());
            List<DiscoveryDocument> batch = fixtures.subList(from, to);
            digest.updateBatch(batch);
            projectBatch(batch, activeTargets, projectedTargets);
        }
    }

    private void projectBatch(
            List<DiscoveryDocument> documents,
            List<DiscoveryProjectionTarget> activeTargets,
            Map<String, ProjectionTargetState> projectedTargets) {
        if (documents.isEmpty() || activeTargets.isEmpty()) {
            return;
        }

        for (DiscoveryProjectionTarget target : new ArrayList<>(activeTargets)) {
            try {
                target.indexBatch(documents);
            } catch (RuntimeException exception) {
                abortQuietly(target, exception);
                activeTargets.remove(target);
                projectedTargets.put(
                        target.indexName(),
                        new ProjectionTargetState(
                                target.indexName(),
                                true,
                                false,
                                null,
                                target.documentCount().orElse(null),
                                exception.getMessage()));
                LOGGER.warn(
                        "Discovery projection target {} failed during a bounded batch; other targets continue: {}",
                        target.indexName(),
                        exception.getMessage());
            }
        }
    }

    private void finishTargets(
            List<DiscoveryProjectionTarget> activeTargets,
            Map<String, ProjectionTargetState> projectedTargets,
            String projectedDocumentSetId) {
        for (DiscoveryProjectionTarget target : new ArrayList<>(activeTargets)) {
            try {
                target.completeProjection();
                Integer count = target.documentCount().orElse(null);
                projectedTargets.put(
                        target.indexName(),
                        new ProjectionTargetState(
                                target.indexName(), true, true, projectedDocumentSetId, count, null));
                LOGGER.info("Discovery projection target {} completed with {} objects.", target.indexName(), count);
            } catch (RuntimeException exception) {
                abortQuietly(target, exception);
                projectedTargets.put(
                        target.indexName(),
                        new ProjectionTargetState(
                                target.indexName(),
                                true,
                                false,
                                null,
                                target.documentCount().orElse(null),
                                exception.getMessage()));
                LOGGER.warn("Discovery projection target {} could not complete: {}", target.indexName(), exception.getMessage());
            }
        }
    }

    private void abortQuietly(DiscoveryProjectionTarget target, RuntimeException primaryFailure) {
        try {
            target.abortProjection();
        } catch (RuntimeException abortFailure) {
            primaryFailure.addSuppressed(abortFailure);
            LOGGER.warn(
                    "Discovery projection target {} also failed during abort: {}",
                    target.indexName(),
                    abortFailure.getMessage());
        }
    }

    /** Results currently searchable from DSpace, for the existing in-memory degradation path. */
    public List<SearchResult> repositoryObjects() {
        return repositoryCatalog.findAllResearchObjects();
    }

    public record ProjectionState(RepositorySource source, int objectCount, OffsetDateTime rebuiltAt) {}

    public record ProjectionTargetState(
            String indexName,
            boolean enabled,
            boolean projected,
            String projectionId,
            Integer documentCount,
            String warning) {}
}
