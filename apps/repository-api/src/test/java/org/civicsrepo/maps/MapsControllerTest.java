package org.civicsrepo.maps;

import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.OffsetDateTime;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(MapsController.class)
class MapsControllerTest {
    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private CensusAreaBoundaryService censusAreaBoundaryService;

    @MockitoBean
    private MapLayerService mapLayerService;

    @MockitoBean
    private UsgsEarthquakeService usgsEarthquakeService;

    @Test
    void serializesDatasetMapLayersIncludingAttribution() throws Exception {
        given(mapLayerService.findDatasetLayers("tiger-line-north-dakota-2025"))
                .willReturn(List.of(new MapLayer(
                        "tiger-boundary",
                        "North Dakota TIGER/Line preview",
                        MapLayerType.CENSUS_BOUNDARY,
                        "https://www2.census.gov/geo/tiger/TIGER2025/",
                        "U.S. Census Bureau TIGER/Line",
                        true)));

        mockMvc.perform(get("/datasets/tiger-line-north-dakota-2025/map-layers"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].layerType").value("CENSUS_BOUNDARY"))
                .andExpect(jsonPath("$[0].attribution").value("U.S. Census Bureau TIGER/Line"))
                .andExpect(jsonPath("$[0].visibleByDefault").value(true));
    }

    @Test
    void serializesCensusAreaBoundaries() throws Exception {
        given(censusAreaBoundaryService.listBoundaries())
                .willReturn(List.of(new CensusAreaBoundary(
                        "north-dakota", "North Dakota", "North Dakota", -104.05, 45.93, -96.55, 49.0, 47.45, -100.3, 6)));

        mockMvc.perform(get("/maps/census-areas"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value("north-dakota"))
                .andExpect(jsonPath("$[0].defaultZoom").value(6.0));
    }

    @Test
    void appliesOverlayQueryDefaults() throws Exception {
        given(usgsEarthquakeService.findEarthquakes(0d, 7)).willReturn(overlay(0d, 7));

        mockMvc.perform(get("/overlays/usgs/earthquakes"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.query.minMagnitude").value(0.0))
                .andExpect(jsonPath("$.query.days").value(7));

        verify(usgsEarthquakeService).findEarthquakes(0d, 7);
    }

    @Test
    void bindsOverlayFilterParameters() throws Exception {
        given(usgsEarthquakeService.findEarthquakes(2.5d, 30)).willReturn(overlay(2.5d, 30));

        mockMvc.perform(get("/overlays/usgs/earthquakes")
                        .param("minMagnitude", "2.5")
                        .param("days", "30"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.fallback").value(true))
                .andExpect(jsonPath("$.features[0].place").value("Western North Dakota"));

        verify(usgsEarthquakeService).findEarthquakes(2.5d, 30);
    }

    @Test
    void rejectsANonNumericMagnitudeFilter() throws Exception {
        mockMvc.perform(get("/overlays/usgs/earthquakes").param("minMagnitude", "strong"))
                .andExpect(status().isBadRequest());
    }

    private UsgsEarthquakeOverlay overlay(double minMagnitude, int days) {
        return new UsgsEarthquakeOverlay(
                "USGS Earthquake Catalog",
                "https://earthquake.usgs.gov/",
                "USGS",
                OffsetDateTime.parse("2026-01-01T00:00:00Z"),
                OffsetDateTime.parse("2026-01-02T00:00:00Z"),
                true,
                new UsgsEarthquakeQuery(minMagnitude, days, 45.93, 49.0, -104.05, -96.55),
                List.of(new UsgsEarthquakeFeature(
                        "nd-1", "Western North Dakota", 2.8, OffsetDateTime.parse("2026-01-01T00:00:00Z"), 47.9, -103.2)));
    }
}
