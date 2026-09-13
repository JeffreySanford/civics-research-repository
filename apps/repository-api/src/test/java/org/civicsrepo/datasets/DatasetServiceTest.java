package org.civicsrepo.datasets;

import org.civicsrepo.generated.dto.ResearchArtifactVersion;
import org.civicsrepo.generated.dto.ResearchObjectDetail;
import org.civicsrepo.generated.dto.DatasetFile;
import org.civicsrepo.generated.dto.FileFormat;
import org.civicsrepo.generated.dto.ResearchProgram;
import org.civicsrepo.repository.FixtureCatalog;
import org.civicsrepo.repository.RepositoryCatalog;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;

class DatasetServiceTest {
    private final DatasetService datasetService = new DatasetService();

    @Test
    void loadsTigerLineDetailForAnySeededCensusArea() {
        ResearchObjectDetail detail = datasetService.getDataset("tiger-line-california-2025");

        assertThat(detail.getTitle()).isEqualTo("2025 TIGER/Line - Census Tracts - California");
        assertThat(detail.getProgram()).isEqualTo(ResearchProgram.TIGER_LINE);
        assertThat(detail.getGeography()).isEqualTo("California");
        assertThat(detail.getFiles()).extracting(DatasetFile::getFormat).contains(FileFormat.ZIP);
        assertThat(detail.getRelatedResearch()).extracting((related) -> related.getId()).contains("lodes-wac-california-2023");
    }

    @Test
    void loadsVersionHistoryForDataset() {
        assertThat(datasetService.getDatasetVersions("lodes-wac-texas-2023"))
                .singleElement()
                .satisfies(version -> {
                    assertThat(version.getCurrent()).isTrue();
                    assertThat(version.getId()).isEqualTo("lodes-wac-texas-2023");
                    assertThat(version.getReleasedOn()).isNotNull();
                });
    }

    @Test
    void delegatesObservedVersionFactsToRepositoryAuthority() {
        RepositoryCatalog repositoryCatalog = mock(RepositoryCatalog.class);
        DatasetService service = new DatasetService(repositoryCatalog, new FixtureCatalog());
        ResearchArtifactVersion expected =
                new ResearchArtifactVersion("artifact-2025", "Artifact 2025").versionLabel("2025.2");
        when(repositoryCatalog.findObservedVersion("artifact-2025")).thenReturn(Optional.of(expected));

        assertThat(service.findObservedRepositoryVersion("artifact-2025"))
                .containsSame(expected);
    }

    @Test
    void hasNoObservedRepositoryVersionWhenRepositoryAuthorityIsUnavailable() {
        assertThat(datasetService.findObservedRepositoryVersion("fixture-only")).isEmpty();
    }

    @Test
    void rejectsUnknownDatasetId() {
        assertThatThrownBy(() -> datasetService.getDataset("missing-dataset"))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("Dataset not found");
    }
}
