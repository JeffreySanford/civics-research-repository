package org.civicsrepo.datasets;

import java.net.URI;
import static org.mockito.BDDMockito.given;
import static org.mockito.BDDMockito.willThrow;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.LocalDate;
import java.util.List;
import org.civicsrepo.generated.dto.DatasetDetail;
import org.civicsrepo.generated.dto.DatasetFile;
import org.civicsrepo.generated.dto.DatasetVersion;
import org.civicsrepo.generated.dto.EvidenceStatus;
import org.civicsrepo.generated.dto.FileFormat;
import org.civicsrepo.generated.dto.ResearchProgram;
import org.civicsrepo.generated.dto.RepositorySource;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.http.HttpStatus;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.server.ResponseStatusException;

@WebMvcTest(DatasetController.class)
class DatasetControllerTest {
    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private DatasetService datasetService;

    @Test
    void serializesDatasetDetail() throws Exception {
        given(datasetService.getDataset("tiger-line-north-dakota-2025")).willReturn(detail());

        mockMvc.perform(get("/datasets/tiger-line-north-dakota-2025"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.source").value("REPOSITORY"))
                .andExpect(jsonPath("$.id").value("tiger-line-north-dakota-2025"))
                .andExpect(jsonPath("$.program").value("TIGER_LINE"))
                .andExpect(jsonPath("$.releasedOn").value("2025-08-01"))
                .andExpect(jsonPath("$.files[0].id").value("source-zip"))
                .andExpect(jsonPath("$.accessibilityEvidenceStatus").value("AUTOMATED_PASS"));
    }

    @Test
    void propagatesNotFoundForAnUnknownDataset() throws Exception {
        willThrow(new ResponseStatusException(HttpStatus.NOT_FOUND, "Unknown dataset"))
                .given(datasetService)
                .getDataset("no-such-dataset");

        mockMvc.perform(get("/datasets/no-such-dataset")).andExpect(status().isNotFound());
    }

    @Test
    void serializesDatasetVersions() throws Exception {
        given(datasetService.getDatasetVersions("tiger-line-north-dakota-2025"))
                .willReturn(List.of(
                        new DatasetVersion("v-current", "Current", true)
                        .releasedOn(LocalDate.of(2025, 8, 1)),
                        new DatasetVersion("v-previous", "Previous", false)
                        .releasedOn(LocalDate.of(2024, 8, 1))));

        mockMvc.perform(get("/datasets/tiger-line-north-dakota-2025/versions"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].current").value(true))
                .andExpect(jsonPath("$[1].current").value(false));
    }

    private DatasetDetail detail() {
        return new DatasetDetail(
                RepositorySource.REPOSITORY,
                "tiger-line-north-dakota-2025",
                "2025 TIGER/Line - Census Tracts - North Dakota",
                ResearchProgram.TIGER_LINE,
                "U.S. Census Bureau",
                "Tract geometry metadata.",
                List.of(new DatasetFile(
                        "source-zip",
                        "TIGER/Line source archive",
                        FileFormat.ZIP,
                        URI.create("https://www2.census.gov/geo/tiger/TIGER2025/"))),
                "U.S. Census Bureau. 2025 TIGER/Line Shapefiles.",
                URI.create("https://www2.census.gov/geo/tiger/TIGER2025/"),
                List.of())
                        .geography("North Dakota")
                        .vintageYear(2025)
                        .releasedOn(LocalDate.of(2025, 8, 1))
                        .accessibilityEvidenceStatus(EvidenceStatus.AUTOMATED_PASS);
    }
}
