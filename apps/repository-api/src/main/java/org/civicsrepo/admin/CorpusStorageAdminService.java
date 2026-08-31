package org.civicsrepo.admin;

import java.util.Arrays;
import java.util.List;
import org.civicsrepo.federation.CorpusProfile;
import org.civicsrepo.federation.CorpusStorageCaptureService;
import org.civicsrepo.federation.CorpusStorageMeasurementStore;
import org.civicsrepo.generated.dto.CorpusProfileSummary;
import org.civicsrepo.generated.dto.CorpusStorageOverview;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/** Corpus-profile overview plus explicit capture of the currently active footprint. */
@Service
public class CorpusStorageAdminService {
    private static final int HISTORY_LIMIT = 50;

    private final CorpusStorageMeasurementStore measurementStore;
    private final CorpusStorageCaptureService captureService;
    private final CorpusProfileActivationService activationService;
    private final org.civicsrepo.federation.DeploymentTopology topology;

    public CorpusStorageAdminService(
            CorpusStorageMeasurementStore measurementStore,
            CorpusStorageCaptureService captureService,
            CorpusProfileActivationService activationService,
            @Value("${civics.deployment.topology:DOCKER_COMPOSE}") String topology) {
        this.measurementStore = measurementStore;
        this.captureService = captureService;
        this.activationService = activationService;
        this.topology = org.civicsrepo.federation.DeploymentTopology.valueOf(topology.trim().toUpperCase());
    }

    /** Current and planned local corpus profiles plus immutable measured history. */
    public CorpusStorageOverview overview() {
        CorpusProfile activeProfile = activationService.currentProfile();
        List<CorpusProfileSummary> profiles = Arrays.stream(CorpusProfile.values())
                .map((profile) -> profileSummary(profile, activeProfile))
                .toList();
        List<org.civicsrepo.generated.dto.CorpusStorageMeasurement> history = measurementStore.findRecent(HISTORY_LIMIT)
                .stream()
                .map(this::toDto)
                .toList();
        return new CorpusStorageOverview(toDto(activeProfile), profiles, history);
    }

    /** Capture the active profile only; retained metadata is measured independently. */
    public org.civicsrepo.generated.dto.CorpusStorageMeasurement captureCurrent() {
        return toDto(captureService.capture(activationService.currentProfile(), topology));
    }

    private CorpusProfileSummary profileSummary(CorpusProfile profile, CorpusProfile activeProfile) {
        CorpusProfileSummary summary =
                new CorpusProfileSummary(toDto(profile), profileLabel(profile), profile == activeProfile);
        profile.targetRecordCount().ifPresent((count) -> summary.targetFederatedRecordCount(count));
        measurementStore.findRecentByProfile(profile, 1).stream()
                .findFirst()
                .map(this::toDto)
                .ifPresent(summary::latestMeasurement);
        return summary;
    }

    private org.civicsrepo.generated.dto.CorpusStorageMeasurement toDto(
            org.civicsrepo.federation.CorpusStorageMeasurement measurement) {
        org.civicsrepo.generated.dto.CorpusStorageMeasurement dto =
                new org.civicsrepo.generated.dto.CorpusStorageMeasurement(
                        measurement.id(),
                        toDto(measurement.profile()),
                        org.civicsrepo.generated.dto.DeploymentTopology.fromValue(measurement.topology().name()),
                        measurement.activeProjectionCount(),
                        measurement.retainedFederatedCount(),
                        measurement.totalMeasuredLocalBytes(),
                        measurement.capturedAt());

        if (measurement.projectionId() != null) {
            dto.projectionId(measurement.projectionId());
        }
        if (measurement.applicationPostgresBytes() != null) {
            dto.applicationPostgresBytes(measurement.applicationPostgresBytes());
        }
        if (measurement.dspaceStoredBytes() != null) {
            dto.dspaceStoredBytes(measurement.dspaceStoredBytes());
        }
        if (measurement.solrIndexBytes() != null) {
            dto.solrIndexBytes(measurement.solrIndexBytes());
        }
        if (measurement.openSearchIndexBytes() != null) {
            dto.openSearchIndexBytes(measurement.openSearchIndexBytes());
        }
        return dto;
    }

    private org.civicsrepo.generated.dto.CorpusProfile toDto(CorpusProfile profile) {
        return org.civicsrepo.generated.dto.CorpusProfile.fromValue(profile.name());
    }

    private String profileLabel(CorpusProfile profile) {
        return switch (profile) {
            case CURATED_DEMO -> "Curated demo";
            case FEDERATED_10K -> "Federated 10K";
            case FEDERATED_100K -> "Federated 100K";
            case FEDERATED_1M -> "Federated 1M";
            case FULL -> "Full source bounds";
        };
    }
}
