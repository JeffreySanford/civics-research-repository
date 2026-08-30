package org.civicsrepo.admin;

import java.util.Arrays;
import java.util.List;
import org.civicsrepo.federation.CorpusStorageCaptureService;
import org.civicsrepo.federation.CorpusStorageMeasurementStore;
import org.civicsrepo.generated.dto.CorpusProfileSummary;
import org.civicsrepo.generated.dto.CorpusStorageOverview;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/** Read-only corpus-profile overview plus explicit capture of the currently active footprint. */
@Service
public class CorpusStorageAdminService {
    private static final org.civicsrepo.federation.CorpusProfile ACTIVE_PROFILE =
            org.civicsrepo.federation.CorpusProfile.CURATED_DEMO;
    private static final int HISTORY_LIMIT = 50;

    private final CorpusStorageMeasurementStore measurementStore;
    private final CorpusStorageCaptureService captureService;
    private final org.civicsrepo.federation.DeploymentTopology topology;

    public CorpusStorageAdminService(
            CorpusStorageMeasurementStore measurementStore,
            CorpusStorageCaptureService captureService,
            @Value("${civics.deployment.topology:DOCKER_COMPOSE}") String topology) {
        this.measurementStore = measurementStore;
        this.captureService = captureService;
        this.topology = org.civicsrepo.federation.DeploymentTopology.valueOf(topology.trim().toUpperCase());
    }

    /**
     * Current and planned local corpus profiles plus immutable measured history.
     *
     * <p>Only CURATED_DEMO is active in F0. Selecting another profile in the UI is deliberately a
     * history/planning view and does not mutate the search projection.
     */
    public CorpusStorageOverview overview() {
        List<CorpusProfileSummary> profiles = Arrays.stream(org.civicsrepo.federation.CorpusProfile.values())
                .map(this::profileSummary)
                .toList();
        List<org.civicsrepo.generated.dto.CorpusStorageMeasurement> history = measurementStore.findRecent(HISTORY_LIMIT)
                .stream()
                .map(this::toDto)
                .toList();
        return new CorpusStorageOverview(toDto(ACTIVE_PROFILE), profiles, history);
    }

    /** Capture the active profile only; there is intentionally no requested-profile argument. */
    public org.civicsrepo.generated.dto.CorpusStorageMeasurement captureCurrent() {
        return toDto(captureService.capture(ACTIVE_PROFILE, topology));
    }

    private CorpusProfileSummary profileSummary(org.civicsrepo.federation.CorpusProfile profile) {
        CorpusProfileSummary summary =
                new CorpusProfileSummary(toDto(profile), profileLabel(profile), profile == ACTIVE_PROFILE);
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

    private org.civicsrepo.generated.dto.CorpusProfile toDto(org.civicsrepo.federation.CorpusProfile profile) {
        return org.civicsrepo.generated.dto.CorpusProfile.fromValue(profile.name());
    }

    private String profileLabel(org.civicsrepo.federation.CorpusProfile profile) {
        return switch (profile) {
            case CURATED_DEMO -> "Curated demo";
            case FEDERATED_10K -> "Federated 10K";
            case FEDERATED_100K -> "Federated 100K";
            case FEDERATED_1M -> "Federated 1M";
            case FULL -> "Full source bounds";
        };
    }
}
