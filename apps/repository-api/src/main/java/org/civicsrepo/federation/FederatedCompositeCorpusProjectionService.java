package org.civicsrepo.federation;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Objects;
import org.civicsrepo.admin.CorpusProfileActivationService;
import org.civicsrepo.repository.DiscoveryProjectionService;
import org.civicsrepo.repository.DiscoveryProjectionService.ProjectionProgressListener;
import org.civicsrepo.repository.DiscoveryProjectionService.ProjectionState;
import org.springframework.stereotype.Service;

/** Projects one exact composite manifest and persists the composition-to-projection relationship. */
@Service
public class FederatedCompositeCorpusProjectionService {
    private final FederatedCompositeCorpusManifestStore manifestStore;
    private final FederatedCorpusManifestService corpusManifestService;
    private final DiscoveryProjectionService projectionService;
    private final CorpusProfileActivationService activationService;
    private final FederatedCompositeCorpusProjectionEvidenceStore evidenceStore;

    public FederatedCompositeCorpusProjectionService(
            FederatedCompositeCorpusManifestStore manifestStore,
            FederatedCorpusManifestService corpusManifestService,
            DiscoveryProjectionService projectionService,
            CorpusProfileActivationService activationService,
            FederatedCompositeCorpusProjectionEvidenceStore evidenceStore) {
        this.manifestStore = manifestStore;
        this.corpusManifestService = corpusManifestService;
        this.projectionService = projectionService;
        this.activationService = activationService;
        this.evidenceStore = evidenceStore;
    }

    public FederatedCompositeCorpusProjectionEvidence project(String compositionSha256) {
        return project(compositionSha256, null);
    }

    public FederatedCompositeCorpusProjectionEvidence project(
            String compositionSha256, ProjectionProgressListener progressListener) {
        FederatedCompositeCorpusManifest composition = manifestStore
                .findByCompositionSha256(compositionSha256)
                .orElseThrow(() -> new IllegalArgumentException(
                        "Unknown composite corpus composition SHA-256."));

        assertCompositionStable(composition, "before");
        ProjectionState projected = progressListener == null
                ? projectionService.reindex(composition)
                : projectionService.reindex(composition, progressListener);
        assertCompositionStable(composition, "after");

        String projectionId = projectionService.currentProjectionId();
        if (projectionId == null || projectionId.isBlank()) {
            throw new IllegalStateException("Composite corpus projection completed without a projectionId");
        }
        if (projected.rebuiltAt() == null) {
            throw new IllegalStateException("Composite corpus projection completed without rebuiltAt evidence");
        }

        activationService.recordSuccessfulProjection(composition.corpusProfile(), projected);
        FederatedCompositeCorpusProjectionEvidence evidence =
                new FederatedCompositeCorpusProjectionEvidence(
                        composition.compositionSha256(),
                        composition.corpusProfile(),
                        composition.federatedRecordCount(),
                        projectionId,
                        projected.source(),
                        projected.objectCount(),
                        projected.rebuiltAt(),
                        OffsetDateTime.now(ZoneOffset.UTC));
        evidenceStore.save(evidence);
        return evidence;
    }

    private void assertCompositionStable(FederatedCompositeCorpusManifest composition, String phase) {
        for (FederatedCompositeCorpusSource source : composition.sources()) {
            FederatedBoundedSnapshotManifest regenerated = corpusManifestService.generateBoundedSnapshot(
                    source.runId(), source.requestedRecordCount());
            if (regenerated.sourceSystem() != source.sourceSystem()
                    || regenerated.retainedRecordCount() != source.requestedRecordCount()
                    || !Objects.equals(regenerated.snapshotId(), source.snapshotId())
                    || !Objects.equals(regenerated.sha256(), source.sha256())) {
                throw new IllegalStateException("Composite source evidence changed "
                        + phase
                        + " projection for "
                        + source.sourceSystem().name()
                        + "; projection evidence was not linked");
            }
        }
    }
}
