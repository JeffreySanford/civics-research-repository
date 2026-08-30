package org.civicsrepo.admin;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Map;
import java.util.Optional;
import org.civicsrepo.federation.CorpusProfile;
import org.civicsrepo.federation.CorpusProfileActivation;
import org.civicsrepo.federation.CorpusProfileActivationStore;
import org.civicsrepo.repository.DiscoveryProjectionService;
import org.civicsrepo.repository.DiscoveryProjectionService.ProjectionState;
import org.civicsrepo.repository.DiscoveryProjectionService.ProjectionTargetState;
import org.civicsrepo.search.SearchService;
import org.springframework.stereotype.Service;

/**
 * Makes corpus-profile changes explicit: a profile is active only after every enabled projection
 * target completed on the same deterministic projection identity and document count.
 */
@Service
public class CorpusProfileActivationService {
    private final DiscoveryProjectionService projectionService;
    private final SearchService searchService;
    private final CorpusProfileActivationStore activationStore;

    public CorpusProfileActivationService(
            DiscoveryProjectionService projectionService,
            SearchService searchService,
            CorpusProfileActivationStore activationStore) {
        this.projectionService = projectionService;
        this.searchService = searchService;
        this.activationStore = activationStore;
    }

    public CorpusProfile currentProfile() {
        return activationStore.findActive()
                .map(CorpusProfileActivation::profile)
                .orElse(CorpusProfile.CURATED_DEMO);
    }

    public Optional<CorpusProfileActivation> currentActivation() {
        return activationStore.findActive();
    }

    public ProjectionState rebuildActiveProfile() {
        return activate(currentProfile());
    }

    public ProjectionState activate(CorpusProfile profile) {
        ProjectionState projected = projectionService.reindex(profile, searchService.fixtureDocuments());
        recordSuccessfulProjection(profile, projected);
        return projected;
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
