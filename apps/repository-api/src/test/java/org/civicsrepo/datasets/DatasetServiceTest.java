package org.civicsrepo.datasets;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.civicsrepo.search.ResearchProgram;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;

class DatasetServiceTest {
    private final DatasetService datasetService = new DatasetService();

    @Test
    void loadsTigerLineDetailForAnySeededCensusArea() {
        DatasetDetail detail = datasetService.getDataset("tiger-line-california-2025");

        assertThat(detail.title()).isEqualTo("2025 TIGER/Line - Census Tracts - California");
        assertThat(detail.program()).isEqualTo(ResearchProgram.TIGER_LINE);
        assertThat(detail.geography()).isEqualTo("California");
        assertThat(detail.files()).extracting(DatasetFile::format).contains(FileFormat.ZIP);
        assertThat(detail.relatedResearch()).extracting((related) -> related.id()).contains("lodes-wac-california-2023");
    }

    @Test
    void loadsVersionHistoryForDataset() {
        assertThat(datasetService.getDatasetVersions("lodes-wac-texas-2023"))
                .hasSize(2)
                .first()
                .extracting(DatasetVersion::current)
                .isEqualTo(true);
    }

    @Test
    void rejectsUnknownDatasetId() {
        assertThatThrownBy(() -> datasetService.getDataset("missing-dataset"))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("Dataset not found");
    }
}
