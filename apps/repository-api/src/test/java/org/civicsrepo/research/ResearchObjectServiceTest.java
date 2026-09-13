package org.civicsrepo.research;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.net.URI;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.civicsrepo.datasets.DatasetService;
import org.civicsrepo.federation.FederatedMetadataCatalog;
import org.civicsrepo.federation.FederatedResearchRecord;
import org.civicsrepo.federation.FederatedSourceSystem;
import org.civicsrepo.generated.dto.RepositorySource;
import org.civicsrepo.generated.dto.ResearchArtifactVersion;
import org.civicsrepo.generated.dto.ResearchObjectDetail;
import org.civicsrepo.generated.dto.ResearchObjectOrigin;
import org.civicsrepo.generated.dto.ResearchObjectType;
import org.civicsrepo.generated.dto.ResearchProgram;
import org.civicsrepo.generated.dto.SourceSystem;
import org.civicsrepo.generated.dto.VersionHistoryStatus;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

class ResearchObjectServiceTest {
    private final ResearchIdCodec codec = new ResearchIdCodec();
    private final FederatedMetadataCatalog federatedCatalog = mock(FederatedMetadataCatalog.class);
    private final DatasetService datasetService = mock(DatasetService.class);
    private final FederatedResearchObjectMapper mapper = new FederatedResearchObjectMapper();
    private final ResearchObjectService service =
            new ResearchObjectService(codec, federatedCatalog, mapper, datasetService);

    @Test
    void resolvesFederatedMetadataWithoutFallingIntoDatasetDetail() {
        FederatedResearchRecord record = record(Map.of(
                "license", "https://creativecommons.org/publicdomain/zero/1.0/",
                "doi", "10.1234/example",
                "issued", "2025-04-15"));
        when(federatedCatalog.findById(record.id())).thenReturn(Optional.of(record));

        ResearchObjectDetail detail = service.getResearchObject(codec.encode(record.id()));

        assertThat(detail.getSource()).isEqualTo(RepositorySource.FEDERATED);
        assertThat(detail.getOrigin()).isEqualTo(ResearchObjectOrigin.FEDERATED);
        assertThat(detail.getSourceSystem()).isEqualTo(SourceSystem.DATA_GOV);
        assertThat(detail.getProgramName()).isEqualTo("Federal Highway Administration");
        assertThat(detail.getFiles()).isEmpty();
        assertThat(detail.getReleasedOn()).isEqualTo(LocalDate.of(2025, 4, 15));
        assertThat(detail.getLicense()).isEqualTo("https://creativecommons.org/publicdomain/zero/1.0/");
        assertThat(detail.getDoi()).isEqualTo("10.1234/example");
        verify(datasetService, never()).getDataset(record.id());
    }

    @Test
    void doesNotMislabelMetadataModifiedTimestampAsReleasedDate() {
        FederatedResearchRecord record = record(Map.of());
        when(federatedCatalog.findById(record.id())).thenReturn(Optional.of(record));

        ResearchObjectDetail detail = service.getResearchObject(codec.encode(record.id()));

        assertThat(detail.getReleasedOn()).isNull();
    }

    @Test
    void delegatesCuratedIdentityToExistingDatasetService() {
        String id = "tiger-line-north-dakota-2025";
        ResearchObjectDetail expected = mock(ResearchObjectDetail.class);
        when(federatedCatalog.findById(id)).thenReturn(Optional.empty());
        when(datasetService.getDataset(id)).thenReturn(expected);

        assertThat(service.getResearchObject(codec.encode(id))).isSameAs(expected);
        verify(datasetService).getDataset(id);
    }

    @Test
    void versionHistoryUsesManagedRepositoryProvenanceWhenDspaceRecordedIt() {
        String id = "tiger-line-north-dakota-2025";
        ResearchObjectDetail detail = new ResearchObjectDetail(
                        RepositorySource.REPOSITORY,
                        id,
                        "2025 TIGER/Line - Census Tracts - North Dakota",
                        ResearchProgram.TIGER_LINE,
                        "U.S. Census Bureau",
                        "Census tract boundaries.",
                        List.of(),
                        "U.S. Census Bureau. 2025 TIGER/Line.",
                        URI.create("https://www2.census.gov/geo/tiger/TIGER2025/TRACT/tl_2025_38_tract.zip"),
                        List.of(),
                        ResearchObjectOrigin.REPOSITORY,
                        SourceSystem.CENSUS)
                .releasedOn(LocalDate.of(2025, 9, 23));
        ResearchArtifactVersion repositoryVersion = new ResearchArtifactVersion(
                        id, "2025 TIGER/Line - Census Tracts - North Dakota")
                .current(true)
                .versionLabel("TIGER2025")
                .versionDate(LocalDate.of(2025, 9, 22))
                .sourceSha256("0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef")
                .capturedAt(OffsetDateTime.parse("2026-09-12T18:45:00-05:00"))
                .sourceUrl(detail.getSourceUrl());

        when(federatedCatalog.findById(id)).thenReturn(Optional.empty());
        when(datasetService.getDataset(id)).thenReturn(detail);
        when(datasetService.findObservedRepositoryVersion(id)).thenReturn(Optional.of(repositoryVersion));

        var history = service.getResearchObjectVersionHistory(codec.encode(id));

        assertThat(history.getStatus()).isEqualTo(VersionHistoryStatus.OBSERVED_CURRENT_ONLY);
        assertThat(history.getVersions()).containsExactly(repositoryVersion);
        assertThat(history.getVersions().getFirst().getVersionLabel()).isEqualTo("TIGER2025");
        assertThat(history.getVersions().getFirst().getSourceSha256())
                .isEqualTo("0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef");
    }

    @Test
    void versionHistoryDoesNotInventRepositoryProvenanceWhenItWasNotRecorded() {
        String id = "fixture-only";
        ResearchObjectDetail detail = new ResearchObjectDetail(
                        RepositorySource.FIXTURE,
                        id,
                        "Fixture object",
                        ResearchProgram.OTHER,
                        "Example publisher",
                        "Fixture detail.",
                        List.of(),
                        "Fixture object.",
                        URI.create("https://example.gov/fixture"),
                        List.of(),
                        ResearchObjectOrigin.FIXTURE,
                        SourceSystem.OTHER)
                .releasedOn(LocalDate.of(2025, 1, 1));

        when(federatedCatalog.findById(id)).thenReturn(Optional.empty());
        when(datasetService.getDataset(id)).thenReturn(detail);

        var history = service.getResearchObjectVersionHistory(codec.encode(id));

        assertThat(history.getVersions()).singleElement().satisfies(version -> {
            assertThat(version.getVersionLabel()).isNull();
            assertThat(version.getSourceSha256()).isNull();
            assertThat(version.getCapturedAt()).isNull();
            assertThat(version.getSupersedes()).isNull();
        });
        verify(datasetService, never()).findObservedRepositoryVersion(id);
    }

    @Test
    void rejectsMalformedTokenAsBadRequestBeforeCatalogLookup() {
        assertThatThrownBy(() -> service.getResearchObject("bad/token="))
                .isInstanceOfSatisfying(ResponseStatusException.class, exception ->
                        assertThat(exception.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST));
        verify(federatedCatalog, never()).findById(org.mockito.ArgumentMatchers.anyString());
    }

    private FederatedResearchRecord record(Map<String, Object> sourceMetadata) {
        return new FederatedResearchRecord(
                FederatedSourceSystem.DATA_GOV,
                "https://data.transportation.gov/api/views/abcd-1234",
                "Example transportation dataset",
                "Federated metadata detail.",
                "U.S. Department of Transportation",
                "Federal Highway Administration",
                ResearchObjectType.DATASET,
                URI.create("https://catalog.data.gov/dataset/example"),
                OffsetDateTime.parse("2026-08-29T12:00:00Z"),
                OffsetDateTime.parse("2026-08-30T12:00:00Z"),
                "data-gov-catalog-v4-v2",
                List.of("Jane Researcher"),
                List.of("transportation"),
                sourceMetadata);
    }
}
