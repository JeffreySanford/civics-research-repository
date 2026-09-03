package org.civicsrepo.maps;

import static org.mockito.BDDMockito.given;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import org.civicsrepo.federation.FederatedSourceSystem;
import org.civicsrepo.generated.dto.ResearchObjectType;
import org.civicsrepo.spatial.ResearchSpatialCoverageFeature;
import org.civicsrepo.spatial.ResearchSpatialCoverageQueryService;
import org.civicsrepo.spatial.ResearchSpatialCoverageResponse;
import org.civicsrepo.spatial.ResearchSpatialCoverageSummary;
import org.civicsrepo.spatial.ResearchSpatialViewport;
import org.civicsrepo.spatial.SpatialGeometryStatus;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(ResearchSpatialCoverageController.class)
class ResearchSpatialCoverageControllerTest {
    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private ResearchSpatialCoverageQueryService queryService;

    @Test
    void serializesPublisherGeoJsonAsGeometryInsteadOfJacksonNodeIntrospection() throws Exception {
        ResearchSpatialViewport viewport = new ResearchSpatialViewport(-125, 24, -66, 50);
        OffsetDateTime capturedAt = OffsetDateTime.parse("2026-09-03T02:44:23.391816Z");
        ResearchSpatialCoverageResponse response = new ResearchSpatialCoverageResponse(
                "build-1",
                "DATA_GOV",
                1,
                capturedAt,
                capturedAt,
                "a".repeat(64),
                "b".repeat(64),
                "c".repeat(64),
                viewport,
                new ResearchSpatialCoverageSummary(1, 1, 0, 0, 0, 1, 1, 0, 5, false),
                List.of(new ResearchSpatialCoverageFeature(
                        "DATA_GOV",
                        "dataset-1",
                        "Publisher point",
                        "NOAA",
                        "Program",
                        ResearchObjectType.DATASET,
                        "https://catalog.data.gov/dataset/dataset-1",
                        SpatialGeometryStatus.VALID,
                        Map.of("type", "Point", "coordinates", List.of(-100.0, 46.0)),
                        -100.0,
                        46.0,
                        "SHAPE_BOUNDS_CENTER")));

        given(queryService.query(
                        null,
                        List.of(),
                        null,
                        FederatedSourceSystem.DATA_GOV,
                        null,
                        null,
                        null,
                        viewport,
                        5))
                .willReturn(response);

        mockMvc.perform(get("/maps/research-coverage")
                        .param("west", "-125")
                        .param("south", "24")
                        .param("east", "-66")
                        .param("north", "50")
                        .param("limit", "5"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.features[0].geometry.type").value("Point"))
                .andExpect(jsonPath("$.features[0].geometry.coordinates[0]").value(-100.0))
                .andExpect(jsonPath("$.features[0].geometry.coordinates[1]").value(46.0))
                .andExpect(jsonPath("$.features[0].geometry.object").doesNotExist())
                .andExpect(jsonPath("$.features[0].geometry.valueNode").doesNotExist());
    }
}
