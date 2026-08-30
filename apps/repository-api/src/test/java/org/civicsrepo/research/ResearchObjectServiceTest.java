package org.civicsrepo.research;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.net.URI;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.civicsrepo.datasets.DatasetService;
import org.civicsrepo.federation.FederatedMetadataCatalog;
import org.civicsrepo.federation.FederatedResearchRecord;
import org.civicsrepo.federation.FederatedSourceSystem;
import org.civicsrepo.generated.dto.RepositorySource;
import org.civicsrepo.generated.dto.ResearchObjectDetail;
import org.civicsrepo.generated.dto.ResearchObjectOrigin;
import org.civicsrepo.generated.dto.ResearchObjectType;
import org.civicsrepo.generated.dto.SourceSystem;
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
        FederatedResearchRecord record = record();
        when(federatedCatalog.findById(record.id())).thenReturn(Optional.of(record));

        ResearchObjectDetail detail = service.getResearchObject(codec.encode(record.id()));

        assertThat(detail.getSource()).isEqualTo(RepositorySource.FEDERATED);
        assertThat(detail.getOrigin()).isEqualTo(ResearchObjectOrigin.FEDERATED);
        assertThat(detail.getSourceSystem()).isEqualTo(SourceSystem.DATA_GOV);
        assertThat(detail.getProgramName()).isEqualTo("Federal Highway Administration");
        assertThat(detail.getFiles()).isEmpty();
        assertThat(detail.getLicense()).isEqualTo("https://creativecommons.org/publicdomain/zero/1.0/");
        assertThat(detail.getDoi()).isEqualTo("10.1234/example");
        verify(datasetService, never()).getDataset(record.id());
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
    void rejectsMalformedTokenAsBadRequestBeforeCatalogLookup() {
        assertThatThrownBy(() -> service.getResearchObject("bad/token="))
                .isInstanceOfSatisfying(ResponseStatusException.class, exception ->
                        assertThat(exception.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST));
        verify(federatedCatalog, never()).findById(org.mockito.ArgumentMatchers.anyString());
    }

    private FederatedResearchRecord record() {
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
                Map.of(
                        "license", "https://creativecommons.org/publicdomain/zero/1.0/",
                        "doi", "10.1234/example"));
    }
}
