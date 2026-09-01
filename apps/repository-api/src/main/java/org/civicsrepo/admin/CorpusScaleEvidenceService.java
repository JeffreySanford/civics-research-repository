package org.civicsrepo.admin;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.civicsrepo.federation.CorpusProfile;
import org.civicsrepo.federation.CorpusProfileActivation;
import org.civicsrepo.federation.CorpusStorageMeasurement;
import org.civicsrepo.federation.CorpusStorageMeasurementStore;
import org.civicsrepo.federation.FederatedMetadataCatalog;
import org.civicsrepo.federation.FederatedSourceSystem;
import org.civicsrepo.repository.DiscoveryProjectionService;
import org.civicsrepo.repository.DiscoveryProjectionService.ProjectionState;
import org.civicsrepo.repository.DiscoveryProjectionService.ProjectionTargetState;
import org.springframework.stereotype.Service;

/** Verifies a named corpus checkpoint without harvesting, projecting, or changing active state. */
@Service
public class CorpusScaleEvidenceService {
    private static final FederatedSourceSystem SCALE_SOURCE = FederatedSourceSystem.DATA_GOV;
    private static final long FEDERATED_1M_DATA_GOV_QUOTA = 500_000L;
    private static final long FEDERATED_1M_OSTI_QUOTA = 500_000L;

    private final FederatedMetadataCatalog metadataCatalog;
    private final CorpusProfileActivationService activationService;
    private final DiscoveryProjectionService projectionService;
    private final CorpusStorageMeasurementStore measurementStore;

    public CorpusScaleEvidenceService(
            FederatedMetadataCatalog metadataCatalog,
            CorpusProfileActivationService activationService,
            DiscoveryProjectionService projectionService,
            CorpusStorageMeasurementStore measurementStore) {
        this.metadataCatalog = metadataCatalog;
        this.activationService = activationService;
        this.projectionService = projectionService;
        this.measurementStore = measurementStore;
    }

    public CorpusScaleEvidenceReport verify(CorpusProfile profile) {
        if (profile == null) {
            throw new IllegalArgumentException("profile is required");
        }

        List<String> violations = new ArrayList<>();
        Long target = profile.targetRecordCount().isPresent()
                ? profile.targetRecordCount().getAsLong()
                : null;
        long retained = retainedTowardProfile(profile, target, violations);
        CorpusProfile activeProfile = activationService.currentProfile();
        Optional<CorpusProfileActivation> activation = activationService.currentActivation();
        ProjectionState projection = projectionService.state();
        String currentProjectionId = projectionService.currentProjectionId();
        Optional<CorpusStorageMeasurement> storage = measurementStore.findRecentByProfile(profile, 1).stream()
                .findFirst();

        if (activeProfile != profile) {
            violations.add("Requested profile is not active; active profile is " + activeProfile + ".");
        }

        if (activation.isEmpty()) {
            violations.add("No persisted successful corpus-profile activation is available.");
        } else {
            CorpusProfileActivation currentActivation = activation.orElseThrow();
            if (currentActivation.profile() != profile) {
                violations.add("Persisted activation belongs to " + currentActivation.profile() + ", not " + profile + ".");
            }
            if (!java.util.Objects.equals(currentActivation.projectionId(), currentProjectionId)) {
                violations.add("Persisted activation projection ID does not match the current projection ID.");
            }
            if (currentActivation.projectionObjectCount() != projection.objectCount()) {
                violations.add("Persisted activation document count does not match the current projection count.");
            }
        }

        boolean targetParity = targetParity(currentProjectionId, projection.objectCount(), projectionService.currentTargetStates());
        if (!targetParity) {
            violations.add("One or more enabled discovery targets are not on the current projection identity/count.");
        }

        if (storage.isEmpty()) {
            violations.add("No persisted storage measurement exists for the requested profile.");
        } else {
            CorpusStorageMeasurement measurement = storage.orElseThrow();
            if (!java.util.Objects.equals(measurement.projectionId(), currentProjectionId)) {
                violations.add("Latest storage measurement projection ID does not match the current projection ID.");
            }
            if (measurement.activeProjectionCount() != projection.objectCount()) {
                violations.add("Latest storage measurement projection count does not match the current projection count.");
            }
            if (target != null && measurement.retainedFederatedCount() < target) {
                violations.add("Latest storage measurement retained count is below the profile target.");
            }
        }

        CorpusProfileActivation activationEvidence = activation.orElse(null);
        CorpusStorageMeasurement storageEvidence = storage.orElse(null);
        return new CorpusScaleEvidenceReport(
                profile,
                violations.isEmpty(),
                target,
                retained,
                activeProfile,
                activationEvidence == null ? null : activationEvidence.projectionObjectCount(),
                activationEvidence == null ? null : activationEvidence.projectionId(),
                projection.objectCount(),
                currentProjectionId,
                targetParity,
                storageEvidence != null,
                storageEvidence == null ? null : storageEvidence.activeProjectionCount(),
                storageEvidence == null ? null : storageEvidence.retainedFederatedCount(),
                storageEvidence == null ? null : storageEvidence.projectionId(),
                storageEvidence == null ? null : storageEvidence.capturedAt(),
                violations);
    }

    private long retainedTowardProfile(CorpusProfile profile, Long target, List<String> violations) {
        long dataGovRetained = metadataCatalog.count(FederatedSourceSystem.DATA_GOV);
        if (profile == CorpusProfile.FEDERATED_1M) {
            long ostiRetained = metadataCatalog.count(FederatedSourceSystem.DOE_OSTI);
            if (dataGovRetained < FEDERATED_1M_DATA_GOV_QUOTA) {
                violations.add("Retained Data.gov metadata is below the FEDERATED_1M source quota: "
                        + dataGovRetained + " < " + FEDERATED_1M_DATA_GOV_QUOTA + ".");
            }
            if (ostiRetained < FEDERATED_1M_OSTI_QUOTA) {
                violations.add("Retained DOE OSTI metadata is below the FEDERATED_1M source quota: "
                        + ostiRetained + " < " + FEDERATED_1M_OSTI_QUOTA + ".");
            }
            return Math.min(dataGovRetained, FEDERATED_1M_DATA_GOV_QUOTA)
                    + Math.min(ostiRetained, FEDERATED_1M_OSTI_QUOTA);
        }

        if (target != null && dataGovRetained < target) {
            violations.add("Retained Data.gov metadata is below the profile target: "
                    + dataGovRetained + " < " + target + ".");
        }
        return target == null ? dataGovRetained : Math.min(dataGovRetained, target);
    }

    private boolean targetParity(
            String projectionId,
            int projectionObjectCount,
            Map<String, ProjectionTargetState> targetStates) {
        List<ProjectionTargetState> enabled = targetStates.values().stream()
                .filter(ProjectionTargetState::enabled)
                .toList();
        if (enabled.isEmpty() || projectionId == null || projectionId.isBlank()) {
            return false;
        }
        return enabled.stream().allMatch(target -> target.projected()
                && projectionId.equals(target.projectionId())
                && target.documentCount() != null
                && target.documentCount() == projectionObjectCount);
    }
}
