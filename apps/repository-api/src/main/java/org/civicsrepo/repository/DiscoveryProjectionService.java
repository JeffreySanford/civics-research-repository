package org.civicsrepo.repository;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.concurrent.atomic.AtomicReference;
import org.civicsrepo.federation.CombinedDiscoveryCatalog;
import org.civicsrepo.federation.CombinedDiscoveryCatalog.DiscoveryCursor;
import org.civicsrepo.federation.CombinedDiscoveryCatalog.DiscoveryPage;
import org.civicsrepo.federation.CorpusProfile;
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
 * <p>Corpus profiles select a deterministic prefix of the federated authority without deleting any
 * retained metadata. CURATED_DEMO includes repository records only; named federated profiles add a
 * stable-ID ordered federated prefix; FULL includes all retained federated metadata.
 *
 * <p>When the selected profile has no authoritative records, the small fixture catalog is projected
 * instead so the demo still functions. That substitution remains explicitly labelled through the
 * compatibility {@link RepositorySource} field and per-result provenance.
 */
@Service
public class DiscoveryProjectionService {
    private static final Logger LOGGER = LoggerFactory.getLogger(DiscoveryProjectionService.class);
    private static final int PROJECTION_BATCH_SIZE = 1_000;
    private static final ProjectionProgressListener NO_PROGRESS = new ProjectionProgressListener() {};

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

    /** All per-target outcomes for the most recent projection attempt. */
    public Map<String, ProjectionTargetState> currentTargetStates() {
        return targetStates.get();
    }

    /** Source of the data currently searchable, used to label compatibility-level API responses. */
    public RepositorySource currentSource() {
        return state.get().source();
    }

    /**
     * Backward-compatible full retained-corpus rebuild used by existing evidence workflows.
     *
     * <p>Operator/runtime paths should prefer {@link #reindex(CorpusProfile, List)} so the selected
     * corpus profile is explicit.
     */
    public ProjectionState reindex(List<DiscoveryDocument> fixtureFallback) {
        return reindex(CorpusProfile.FULL, fixtureFallback, NO_PROGRESS);
    }

    /** Rebuild every configured discovery target from the deterministic slice selected by profile. */
    public ProjectionState reindex(CorpusProfile profile, List<DiscoveryDocument> fixtureFallback) {
        return reindex(profile, fixtureFallback, NO_PROGRESS);
    }

    /**
     * Rebuild every configured discovery target while reporting exact batch progress to an operator
     * workflow. Progress counts normalized documents after each bounded batch is handed to all
     * still-active projection targets; it is not an elapsed-time estimate.
     */
    public ProjectionState reindex(
            CorpusProfile profile,
            List<DiscoveryDocument> fixtureFallback,
            ProjectionProgressListener progressListener) {
        Objects.requireNonNull(profile, "profile");
        ProjectionProgressListener progress = progressListener == null ? NO_PROGRESS : progressListener;
        repositoryCatalog.invalidate();
        List<DiscoveryDocument> repositoryObjects = repositoryCatalog.findAllDiscoveryDocuments();
        long federatedCount = combinedDiscoveryCatalog.retainedFederatedCount();
        validateProfileAvailability(profile, federatedCount);

        boolean includesFederated = profile != CorpusProfile.CURATED_DEMO;
        boolean authorityBacked = !repositoryObjects.isEmpty() || (includesFederated && federatedCount > 0);
        RepositorySource source = authorityBacked ? RepositorySource.REPOSITORY : RepositorySource.FIXTURE;
        List<DiscoveryDocument> safeFixtures = fixtureFallback == null ? List.of() : fixtureFallback;
        long plannedDocumentCount = plannedDocumentCount(
                profile, repositoryObjects.size(), federatedCount, authorityBacked, safeFixtures.size());

        Map<String, ProjectionTargetState> projectedTargets = new LinkedHashMap<>();
        List<DiscoveryProjectionTarget> activeTargets = beginTargets(projectedTargets);
        DiscoveryProjectionDigest digest = new DiscoveryProjectionDigest();
        List<String> indexedRepositoryIds = new ArrayList<>();
        progress.projectionStarted(plannedDocumentCount);

        if (authorityBacked) {
            if (profile == CorpusProfile.CURATED_DEMO) {
                projectRepository(
                        repositoryObjects,
                        activeTargets,
                        projectedTargets,
                        digest,
                        indexedRepositoryIds,
                        plannedDocumentCount,
                        progress);
            } else {
                projectCombined(
                        profile,
                        activeTargets,
                        projectedTargets,
                        digest,
                        indexedRepositoryIds,
                        plannedDocumentCount,
                        progress);
            }
        } else {
            projectFixtures(
                    safeFixtures,
                    activeTargets,
                    projectedTargets,
                    digest,
                    plannedDocumentCount,
                    progress);
        }

        String projectedDocumentSetId = digest.finish();
        progress.verificationStarted(digest.documentCount(), plannedDocumentCount);
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
            long projectedFederated = Math.max(0L, projectedCount - repositoryObjects.size());
            LOGGER.info(
                    "Discovery projection rebuilt for profile {}: {} objects ({} DSpace, {} federated; {} federated retained).",
                    profile,
                    projectedCount,
                    repositoryObjects.size(),
                    projectedFederated,
                    federatedCount);
        } else {
            LOGGER.warn(
                    "Discovery projection for profile {} is serving {} FIXTURE research objects because the selected"
                            + " profile returned no authoritative records.",
                    profile,
                    projectedCount);
        }

        return projected;
    }

    private long plannedDocumentCount(
            CorpusProfile profile,
            int repositoryCount,
            long federatedCount,
            boolean authorityBacked,
            int fixtureCount) {
        if (!authorityBacked) {
            return fixtureCount;
        }
        if (profile == CorpusProfile.CURATED_DEMO) {
            return repositoryCount;
        }
        long federatedTarget = profile.targetRecordCount().orElse(federatedCount);
        return Math.addExact(repositoryCount, federatedTarget);
    }

    private void validateProfileAvailability(CorpusProfile profile, long federatedCount) {
        profile.targetRecordCount().ifPresent((target) -> {
            if (federatedCount < target) {
                throw new IllegalStateException(
                        "Corpus profile " + profile + " requires " + target + " retained federated records; only "
                                + federatedCount + " are available.");
            }
        });
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

    private void projectRepository(
            List<DiscoveryDocument> repositoryObjects,
            List<DiscoveryProjectionTarget> activeTargets,
            Map<String, ProjectionTargetState> projectedTargets,
            DiscoveryProjectionDigest digest,
            List<String> indexedRepositoryIds,
            long totalDocuments,
            ProjectionProgressListener progress) {
        List<DiscoveryDocument> repository = repositoryObjects.stream()
                .sorted(Comparator.comparing((document) -> document.result().getId()))
                .toList();
        for (int from = 0; from < repository.size(); from += PROJECTION_BATCH_SIZE) {
            int to = Math.min(from + PROJECTION_BATCH_SIZE, repository.size());
            List<DiscoveryDocument> batch = repository.subList(from, to);
            digest.updateBatch(batch);
            batch.stream().map((document) -> document.result().getId()).forEach(indexedRepositoryIds::add);
            projectBatch(batch, activeTargets, projectedTargets);
            progress.documentsProjected(digest.documentCount(), totalDocuments);
        }
    }

    private void projectCombined(
            CorpusProfile profile,
            List<DiscoveryProjectionTarget> activeTargets,
            Map<String, ProjectionTargetState> projectedTargets,
            DiscoveryProjectionDigest digest,
            List<String> indexedRepositoryIds,
            long totalDocuments,
            ProjectionProgressListener progress) {
        long federatedLimit = profile.targetRecordCount().orElse(Long.MAX_VALUE);
        long projectedFederated = 0;
        DiscoveryCursor cursor = null;
        boolean complete = false;
        while (!complete) {
            DiscoveryPage page = combinedDiscoveryCatalog.findAfter(cursor, PROJECTION_BATCH_SIZE);
            List<DiscoveryDocument> documents = page.documents();
            if (federatedLimit != Long.MAX_VALUE) {
                List<DiscoveryDocument> bounded = new ArrayList<>(documents.size());
                for (DiscoveryDocument document : documents) {
                    if (document.result().getOrigin() == ResearchObjectOrigin.FEDERATED) {
                        if (projectedFederated >= federatedLimit) {
                            continue;
                        }
                        projectedFederated++;
                    }
                    bounded.add(document);
                }
                documents = List.copyOf(bounded);
            } else {
                projectedFederated += documents.stream()
                        .filter((document) -> document.result().getOrigin() == ResearchObjectOrigin.FEDERATED)
                        .count();
            }

            digest.updateBatch(documents);
            documents.stream()
                    .filter((document) -> document.result().getOrigin() == ResearchObjectOrigin.REPOSITORY)
                    .map((document) -> document.result().getId())
                    .forEach(indexedRepositoryIds::add);
            projectBatch(documents, activeTargets, projectedTargets);
            progress.documentsProjected(digest.documentCount(), totalDocuments);

            complete = page.complete() || projectedFederated >= federatedLimit;
            cursor = complete ? null : page.nextCursor();
        }
    }

    private void projectFixtures(
            List<DiscoveryDocument> fixtureFallback,
            List<DiscoveryProjectionTarget> activeTargets,
            Map<String, ProjectionTargetState> projectedTargets,
            DiscoveryProjectionDigest digest,
            long totalDocuments,
            ProjectionProgressListener progress) {
        List<DiscoveryDocument> fixtures = fixtureFallback.stream()
                .sorted(Comparator.comparing((document) -> document.result().getId()))
                .toList();
        for (int from = 0; from < fixtures.size(); from += PROJECTION_BATCH_SIZE) {
            int to = Math.min(from + PROJECTION_BATCH_SIZE, fixtures.size());
            List<DiscoveryDocument> batch = fixtures.subList(from, to);
            digest.updateBatch(batch);
            projectBatch(batch, activeTargets, projectedTargets);
            progress.documentsProjected(digest.documentCount(), totalDocuments);
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

    /** Exact progress callbacks for the bounded projection loop. */
    public interface ProjectionProgressListener {
        default void projectionStarted(long totalDocuments) {}

        default void documentsProjected(long processedDocuments, long totalDocuments) {}

        default void verificationStarted(long processedDocuments, long totalDocuments) {}
    }
}
