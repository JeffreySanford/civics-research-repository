package org.civicsrepo.datasets;

import org.civicsrepo.generated.dto.DatasetDetail;
import org.civicsrepo.generated.dto.DatasetFile;
import org.civicsrepo.generated.dto.DatasetVersion;
import org.civicsrepo.generated.dto.FileFormat;
import org.civicsrepo.generated.dto.ResearchProgram;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;

class DatasetServiceTest {
    private final DatasetService datasetService = new DatasetService();

    @Test
    void loadsTigerLineDetailForAnySeededCensusArea() {
        DatasetDetail detail = datasetService.getDataset("tiger-line-california-2025");

        assertThat(detail.getTitle()).isEqualTo("2025 TIGER/Line - Census Tracts - California");
        assertThat(detail.getProgram()).isEqualTo(ResearchProgram.TIGER_LINE);
        assertThat(detail.getGeography()).isEqualTo("California");
        assertThat(detail.getFiles()).extracting(DatasetFile::getFormat).contains(FileFormat.ZIP);
        assertThat(detail.getRelatedResearch()).extracting((related) -> related.getId()).contains("lodes-wac-california-2023");
    }

    @Test
    void loadsVersionHistoryForDataset() {
        assertThat(datasetService.getDatasetVersions("lodes-wac-texas-2023"))
                .hasSize(2)
                .first()
                .extracting(DatasetVersion::getCurrent)
                .isEqualTo(true);
    }

    @Test
    void rejectsUnknownDatasetId() {
        assertThatThrownBy(() -> datasetService.getDataset("missing-dataset"))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("Dataset not found");
    }
}
