package org.civicsrepo.admin;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import org.civicsrepo.federation.CorpusProfile;
import org.civicsrepo.federation.CorpusProfileActivation;
import org.civicsrepo.federation.CorpusProfileActivationStore;
import org.civicsrepo.repository.DiscoveryProjectionService;
import org.civicsrepo.repository.DiscoveryProjectionService.ProjectionProgressListener;
import org.civicsrepo.repository.DiscoveryProjectionService.ProjectionState;
import org.civicsrepo.repository.DiscoveryProjectionService.ProjectionTargetState;
import org.civicsrepo.search.DiscoveryDocument;
import org.civicsrepo.search.SearchService;
import org.springframework.stereotype.Service;

/**
 * Makes corpus-profile changes explicit: a profile is active only after every enabled projection
 * target completed on the same deterministic projection identity and document count.
 *
 * <p>If a requested profile reaches the projection targets but fails final parity validation, the
 * service compensates by rebuilding the previously active profile. The persisted active profile is
 * never changed until a projection is fully valid.
 */
@Service
public class CorpusProfileActivationService {
    private final DiscoveryProjectionService projectionService;
    private final SearchService searchService;
    private final CorpusProfileActivationStore activationStore;
    private final CorpusProfileActivationProgressTracker progressTracker;

    public CorpusProfileActivationService(
            DiscoveryProjectionService projectionService,
            SearchService searchService,
            CorpusProfileActivationStore activationStore,
            CorpusProfileActivationProgressTracker progressTracker) {
        this.projectionService = projectionService;
        this.searchService = searchService;
        this.activationStore = activationStore;
        this.progressTracker = progressTracker;
    }

    public CorpusProfile currentProfile() {
        return activationStore.findActive()
                .map(CorpusProfileActivation::profile)
                .orElse(CorpusProfile.CURATED_DEMO);
    }

    public Optional<CorpusProfileActivation> currentActivation() {
        return activationStore.findActive();
    }

    public CorpusProfileActivationProgress currentProgress() {
        return progressTracker.current();
    }

    public ProjectionState rebuildActiveProfile() {
        return activate(currentProfile());
    }

    public ProjectionState activate(CorpusProfile profile) {
        Objects.requireNonNull(profile, "profile");
        progressTracker.begin(profile);

        CorpusProfile previousProfile = null;
        String previousProjectionId = null;
        List<DiscoveryDocument> fixtureFallback = List.of();

        try {
            previousProfile = currentProfile();
            previousProjectionId = projectionService.currentProjectionId();
            fixtureFallback = searchService.fixtureDocuments();

            ProjectionState projected = projectionService.reindex(profile, fixtureFallback, progressListener());
            recordSuccessfulProjection(profile, projected);
            progressTracker.complete(projected.objectCount(), projected.objectCount());
            return projected;
        } catch (RuntimeException activationFailure) {
            if (previousProfile != null) {
                String failedProjectionId = projectionService.currentProjectionId();
                boolean projectionChanged = !Objects.equals(previousProjectionId, failedProjectionId);
                if (profile != previousProfile && projectionChanged) {
                    restorePreviousProfile(previousProfile, fixtureFallback, activationFailure);
                }
            }
            progressTracker.fail(activationFailure);
            throw activationFailure;
        }
    }

    private ProjectionProgressListener progressListener() {
        return new ProjectionProgressListener() {
            @Override
            public void projectionStarted(long totalDocuments) {
                progressTracker.projectionStarted(totalDocuments);
            }

            @Override
            public void documentsProjected(long processedDocuments, long totalDocuments) {
                progressTracker.projected(processedDocuments, totalDocuments);
            }

            @Override
            public void verificationStarted(long processedDocuments, long totalDocuments) {
                progressTracker.verifying(processedDocuments, totalDocuments);
            }
        };
    }

    /** Record a projection produced by another guarded workflow, such as snapshot evidence capture. */
    public void recordSuccessfulProjection(CorpusProfile profile, ProjectionState projected) {
        String projectionId = projectionService.currentProjectionId();
        if (projectionId == null || projectionId.isBlank()) {
            throw new IllegalStateException("Corpus profile activation completed without a projection ID.");
        }
        assertTargetParity(projected, projectionId, projectionService.currentTargetStates());
        activationStore.save(new CorpusProfileActivation(
                profile,
                projectionId,
                projected.objectCount(),
                OffsetDateTime.now(ZoneOffset.UTC)));
    }

    private void restorePreviousProfile(
            CorpusProfile previousProfile,
            List<DiscoveryDocument> fixtureFallback,
            RuntimeException activationFailure) {
        try {
            ProjectionState restored = projectionService.reindex(previousProfile, fixtureFallback);
            recordSuccessfulProjection(previousProfile, restored);
        } catch (RuntimeException restoreFailure) {
            activationFailure.addSuppressed(restoreFailure);
        }
    }

    private void assertTargetParity(
            ProjectionState projected,
            String projectionId,
            Map<String, ProjectionTargetState> targetStates) {
        for (ProjectionTargetState target : targetStates.values()) {
            if (!target.enabled()) {
                continue;
            }
            if (!target.projected()) {
                throw new IllegalStateException(
                        "Corpus profile activation failed for target " + target.indexName() + ": " + target.warning());
            }
            if (!projectionId.equals(target.projectionId())) {
                throw new IllegalStateException(
                        "Corpus profile activation projection ID mismatch for target " + target.indexName());
            }
            if (target.documentCount() == null || target.documentCount() != projected.objectCount()) {
                throw new IllegalStateException(
                        "Corpus profile activation document-count mismatch for target " + target.indexName());
            }
        }
    }
}
