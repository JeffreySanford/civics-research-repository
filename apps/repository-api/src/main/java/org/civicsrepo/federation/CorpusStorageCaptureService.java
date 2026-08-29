package org.civicsrepo.federation;

import java.time.OffsetDateTime;
import java.util.OptionalLong;
import java.util.UUID;
import org.civicsrepo.dspace.DspaceRestClient;
import org.civicsrepo.repository.DiscoveryProjectionService;
import org.springframework.stereotype.Service;

/** Captures one immutable local storage snapshot for a corpus profile and deployment topology. */
@Service
public class CorpusStorageCaptureService {
    private final FederatedMetadataCatalog federatedMetadataCatalog;
    private final CorpusStorageMeasurementStore measurementStore;
    private final DiscoveryProjectionService discoveryProjectionService;
    private final ApplicationDatabaseStorageProbe databaseStorageProbe;
    private final SearchIndexStorageProbe searchIndexStorageProbe;
    private final DspaceRestClient dspaceRestClient;

    public CorpusStorageCaptureService(
            FederatedMetadataCatalog federatedMetadataCatalog,
            CorpusStorageMeasurementStore measurementStore,
            DiscoveryProjectionService discoveryProjectionService,
            ApplicationDatabaseStorageProbe databaseStorageProbe,
            SearchIndexStorageProbe searchIndexStorageProbe,
            DspaceRestClient dspaceRestClient) {
        this.federatedMetadataCatalog = federatedMetadataCatalog;
        this.measurementStore = measurementStore;
        this.discoveryProjectionService = discoveryProjectionService;
        this.databaseStorageProbe = databaseStorageProbe;
        this.searchIndexStorageProbe = searchIndexStorageProbe;
        this.dspaceRestClient = dspaceRestClient;
    }

    public CorpusStorageMeasurement capture(CorpusProfile profile, DeploymentTopology topology) {
        DiscoveryProjectionService.ProjectionState projection = discoveryProjectionService.state();
        CorpusStorageMeasurement measurement = new CorpusStorageMeasurement(
                UUID.randomUUID().toString(),
                profile,
                topology,
                projection.objectCount(),
                federatedMetadataCatalog.count(),
                discoveryProjectionService.currentProjectionId(),
                boxed(databaseStorageProbe.databaseSizeBytes()),
                dspaceRestClient.summarizeStoredBitstreams()
                        .map(DspaceRestClient.StoredBitstreams::totalBytes)
                        .orElse(null),
                boxed(searchIndexStorageProbe.solrIndexBytes()),
                boxed(searchIndexStorageProbe.openSearchIndexBytes()),
                OffsetDateTime.now());
        measurementStore.save(measurement);
        return measurement;
    }

    private Long boxed(OptionalLong value) {
        return value.isPresent() ? value.getAsLong() : null;
    }
}
