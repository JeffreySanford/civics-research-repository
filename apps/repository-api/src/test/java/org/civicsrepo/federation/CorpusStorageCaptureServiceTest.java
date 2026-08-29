package org.civicsrepo.federation;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.OptionalLong;
import org.civicsrepo.dspace.DspaceRestClient;
import org.civicsrepo.generated.dto.RepositorySource;
import org.civicsrepo.repository.DiscoveryProjectionService;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

class CorpusStorageCaptureServiceTest {
    @Test
    void capturesMeasuredStorageAndSeparatesActiveFromRetainedCounts() {
        FederatedMetadataCatalog catalog = mock(FederatedMetadataCatalog.class);
        CorpusStorageMeasurementStore store = mock(CorpusStorageMeasurementStore.class);
        DiscoveryProjectionService projectionService = mock(DiscoveryProjectionService.class);
        ApplicationDatabaseStorageProbe databaseProbe = mock(ApplicationDatabaseStorageProbe.class);
        SearchIndexStorageProbe searchProbe = mock(SearchIndexStorageProbe.class);
        DspaceRestClient dspace = mock(DspaceRestClient.class);

        when(catalog.count()).thenReturn(1_000_000L);
        when(projectionService.state()).thenReturn(new DiscoveryProjectionService.ProjectionState(
                RepositorySource.REPOSITORY, 181, OffsetDateTime.parse("2026-08-29T12:00:00Z")));
        when(projectionService.currentProjectionId()).thenReturn("a".repeat(64));
        when(databaseProbe.databaseSizeBytes()).thenReturn(OptionalLong.of(10_000L));
        when(searchProbe.solrIndexBytes()).thenReturn(OptionalLong.of(20_000L));
        when(searchProbe.openSearchIndexBytes()).thenReturn(OptionalLong.of(30_000L));
        when(dspace.summarizeStoredBitstreams()).thenReturn(Optional.of(new DspaceRestClient.StoredBitstreams(2, 40_000L)));

        CorpusStorageCaptureService service = new CorpusStorageCaptureService(
                catalog, store, projectionService, databaseProbe, searchProbe, dspace);
        CorpusStorageMeasurement measurement =
                service.capture(CorpusProfile.CURATED_DEMO, DeploymentTopology.DOCKER_COMPOSE);

        assertEquals(181, measurement.activeProjectionCount());
        assertEquals(1_000_000L, measurement.retainedFederatedCount());
        assertEquals("a".repeat(64), measurement.projectionId());
        assertEquals(100_000L, measurement.totalMeasuredLocalBytes());

        ArgumentCaptor<CorpusStorageMeasurement> saved =
                ArgumentCaptor.forClass(CorpusStorageMeasurement.class);
        verify(store).save(saved.capture());
        assertEquals(measurement.id(), saved.getValue().id());
    }

    @Test
    void preservesUnknownMeasurementsAsNullInsteadOfZero() {
        FederatedMetadataCatalog catalog = mock(FederatedMetadataCatalog.class);
        CorpusStorageMeasurementStore store = mock(CorpusStorageMeasurementStore.class);
        DiscoveryProjectionService projectionService = mock(DiscoveryProjectionService.class);
        ApplicationDatabaseStorageProbe databaseProbe = mock(ApplicationDatabaseStorageProbe.class);
        SearchIndexStorageProbe searchProbe = mock(SearchIndexStorageProbe.class);
        DspaceRestClient dspace = mock(DspaceRestClient.class);

        when(projectionService.state()).thenReturn(
                new DiscoveryProjectionService.ProjectionState(RepositorySource.FIXTURE, 0, null));
        when(databaseProbe.databaseSizeBytes()).thenReturn(OptionalLong.empty());
        when(searchProbe.solrIndexBytes()).thenReturn(OptionalLong.empty());
        when(searchProbe.openSearchIndexBytes()).thenReturn(OptionalLong.empty());
        when(dspace.summarizeStoredBitstreams()).thenReturn(Optional.empty());

        CorpusStorageCaptureService service = new CorpusStorageCaptureService(
                catalog, store, projectionService, databaseProbe, searchProbe, dspace);
        CorpusStorageMeasurement measurement =
                service.capture(CorpusProfile.CURATED_DEMO, DeploymentTopology.DOCKER_COMPOSE);

        assertNull(measurement.applicationPostgresBytes());
        assertNull(measurement.dspaceStoredBytes());
        assertNull(measurement.solrIndexBytes());
        assertNull(measurement.openSearchIndexBytes());
        assertEquals(0, measurement.totalMeasuredLocalBytes());
        verify(store).save(any(CorpusStorageMeasurement.class));
    }
}
