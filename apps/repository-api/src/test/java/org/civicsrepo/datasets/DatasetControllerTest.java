package org.civicsrepo.datasets;

import static org.mockito.BDDMockito.given;
import static org.mockito.BDDMockito.willThrow;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.LocalDate;
import java.util.List;
import org.civicsrepo.search.ResearchProgram;
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
                        new DatasetVersion("v-current", "Current", LocalDate.of(2025, 8, 1), true),
                        new DatasetVersion("v-previous", "Previous", LocalDate.of(2024, 8, 1), false)));

        mockMvc.perform(get("/datasets/tiger-line-north-dakota-2025/versions"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].current").value(true))
                .andExpect(jsonPath("$[1].current").value(false));
    }

    private DatasetDetail detail() {
        return new DatasetDetail(
                "tiger-line-north-dakota-2025",
                "2025 TIGER/Line - Census Tracts - North Dakota",
                ResearchProgram.TIGER_LINE,
                "U.S. Census Bureau",
                "Tract geometry metadata.",
                "North Dakota",
                2025,
                LocalDate.of(2025, 8, 1),
                List.of(new DatasetFile(
                        "source-zip",
                        "TIGER/Line source archive",
                        FileFormat.ZIP,
                        "https://www2.census.gov/geo/tiger/TIGER2025/",
                        null)),
                "U.S. Census Bureau. 2025 TIGER/Line Shapefiles.",
                "https://www2.census.gov/geo/tiger/TIGER2025/",
                EvidenceStatus.AUTOMATED_PASS,
                List.of());
    }
}
