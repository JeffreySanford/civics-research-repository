package org.civicsrepo.admin;

import java.util.List;
import org.civicsrepo.federation.CorpusProfile;
import org.civicsrepo.federation.FederatedCompositeCorpusManifest;
import org.civicsrepo.federation.FederatedCompositeCorpusManifestStore;
import org.civicsrepo.federation.FederatedCompositeCorpusProjectionService;
import org.civicsrepo.federation.FederatedCompositeCorpusSource;
import org.civicsrepo.federation.FederatedSourceSystem;
import org.civicsrepo.repository.DiscoveryProjectionService;
import org.civicsrepo.repository.DiscoveryProjectionService.ProjectionProgressListener;
import org.civicsrepo.repository.DiscoveryProjectionService.ProjectionState;
import org.springframework.stereotype.Service;

/**
 * Activates evidence-grade composite profiles through their exact immutable source recipe.
 *
 * <p>FEDERATED_1M is the C2 research corpus: exactly 500,000 Data.gov records plus exactly 500,000
 * DOE OSTI records. A generic first-million retained prefix is deliberately not accepted as an
 * equivalent activation. The selected composition is revalidated by the composite projection
 * service before and after indexing, and normal activation progress remains visible to Admin.
 */
@Service
public class ExactCompositeCorpusActivationService {
    private static final long C2_SOURCE_QUOTA = 500_000L;
    private static final long C2_FEDERATED_TOTAL = 1_000_000L;
    private static final int MANIFEST_SEARCH_LIMIT = 1_000;

    private final FederatedCompositeCorpusManifestStore manifestStore;
    private final FederatedCompositeCorpusProjectionService compositeProjectionService;
    private final DiscoveryProjectionService discoveryProjectionService;
    private final CorpusProfileActivationProgressTracker progressTracker;

    public ExactCompositeCorpusActivationService(
            FederatedCompositeCorpusManifestStore manifestStore,
            FederatedCompositeCorpusProjectionService compositeProjectionService,
            DiscoveryProjectionService discoveryProjectionService,
            CorpusProfileActivationProgressTracker progressTracker) {
        this.manifestStore = manifestStore;
        this.compositeProjectionService = compositeProjectionService;
        this.discoveryProjectionService = discoveryProjectionService;
        this.progressTracker = progressTracker;
    }

    /** Activate the exact evidence recipe represented by the requested composite profile. */
    public ProjectionState activate(CorpusProfile profile) {
        if (profile != CorpusProfile.FEDERATED_1M) {
            throw new IllegalArgumentException("Exact composite activation is currently defined only for FEDERATED_1M.");
        }

        progressTracker.begin(profile);
        try {
            FederatedCompositeCorpusManifest composition = resolveC2Composition();
            compositeProjectionService.project(composition.compositionSha256(), progressListener());
            ProjectionState projected = discoveryProjectionService.state();
            progressTracker.complete(
                    projected.objectCount(),
                    projected.objectCount(),
                    "Exact C2 composite activation completed: 500,000 Data.gov + 500,000 DOE OSTI.");
            return projected;
        } catch (RuntimeException failure) {
            progressTracker.fail(failure);
            throw failure;
        }
    }

    private FederatedCompositeCorpusManifest resolveC2Composition() {
        List<FederatedCompositeCorpusManifest> recent =
                manifestStore.findRecent(CorpusProfile.FEDERATED_1M, MANIFEST_SEARCH_LIMIT);
        return recent.stream()
                .filter(this::isExactC2)
                .findFirst()
                .orElseThrow(() -> new IllegalStateException(
                        "FEDERATED_1M activation requires exact C2 composition evidence: "
                                + "500000 DATA_GOV + 500000 DOE_OSTI."));
    }

    private boolean isExactC2(FederatedCompositeCorpusManifest manifest) {
        if (manifest.corpusProfile() != CorpusProfile.FEDERATED_1M
                || manifest.federatedRecordCount() != C2_FEDERATED_TOTAL
                || manifest.sources().size() != 2) {
            return false;
        }
        return exactSourceQuota(manifest, FederatedSourceSystem.DATA_GOV) == C2_SOURCE_QUOTA
                && exactSourceQuota(manifest, FederatedSourceSystem.DOE_OSTI) == C2_SOURCE_QUOTA;
    }

    private long exactSourceQuota(
            FederatedCompositeCorpusManifest manifest, FederatedSourceSystem sourceSystem) {
        return manifest.sources().stream()
                .filter(source -> source.sourceSystem() == sourceSystem)
                .mapToLong(FederatedCompositeCorpusSource::requestedRecordCount)
                .findFirst()
                .orElse(-1L);
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
}
