package org.civicsrepo.maps;

import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.net.URI;
import java.time.OffsetDateTime;
import java.util.List;
import org.civicsrepo.generated.dto.CensusAreaBoundary;
import org.civicsrepo.generated.dto.MapLayer;
import org.civicsrepo.generated.dto.MapLayerType;
import org.civicsrepo.generated.dto.UsgsEarthquakeFeature;
import org.civicsrepo.generated.dto.UsgsEarthquakeOverlay;
import org.civicsrepo.generated.dto.UsgsEarthquakeQuery;
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

    @MockitoBean
    private LodesFlowService lodesFlowService;

    @MockitoBean
    private LodesWorkplaceService lodesWorkplaceService;

    @MockitoBean
    private SaipeCountyChoroplethService saipeCountyChoroplethService;

    @MockitoBean
    private PopulationEstimatesService populationEstimatesService;

    @MockitoBean
    private UsgsHydrographyTileService usgsHydrographyTileService;

    @MockitoBean
    private UsgsTerrainTileService usgsTerrainTileService;

    @Test
    void serializesDatasetMapLayersIncludingAttribution() throws Exception {
        given(mapLayerService.findDatasetLayers("tiger-line-north-dakota-2025"))
                .willReturn(List.of(new MapLayer(
                                "tiger-boundary",
                                "North Dakota TIGER/Line preview",
                                MapLayerType.CENSUS_BOUNDARY,
                                URI.create("https://www2.census.gov/geo/tiger/TIGER2025/"),
                                "U.S. Census Bureau TIGER/Line")
                        .visibleByDefault(true)));

        mockMvc.perform(get("/datasets/tiger-line-north-dakota-2025/map-layers"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].layerType").value("CENSUS_BOUNDARY"))
                .andExpect(jsonPath("$[0].attribution").value("U.S. Census Bureau TIGER/Line"))
                .andExpect(jsonPath("$[0].visibleByDefault").value(true));
    }

    @Test
    void serializesCensusAreaBoundaries() throws Exception {
        given(censusAreaBoundaryService.listBoundaries())
                .willReturn(List.of(new CensusAreaBoundary()
                        .id("north-dakota")
                        .label("North Dakota")
                        .geography("North Dakota")
                        .west(-104.05)
                        .south(45.93)
                        .east(-96.55)
                        .north(49.0)
                        .centerLatitude(47.45)
                        .centerLongitude(-100.3)
                        .defaultZoom(6.0)));

        mockMvc.perform(get("/maps/census-areas"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value("north-dakota"))
                .andExpect(jsonPath("$[0].defaultZoom").value(6.0));
    }

    @Test
    void appliesPopulationEstimateDefaults() throws Exception {
        var response =
                new org.civicsrepo.generated.dto.PopulationEstimatesChoropleth(
                        "U.S. Census Bureau Population Estimates Program",
                        URI.create("https://example.test/co-est2025-alldata.csv"),
                        "U.S. Census Bureau Population Estimates Program",
                        "North Dakota",
                        2025,
                        "4f5a499d851e2cb48fd7a5405e5a9235453a8a66933657aacd10df0e264f35d5",
                        java.time.LocalDate.parse("2026-09-05"),
                        2025,
                        URI.create("https://example.test/tigerweb/2025/counties"),
                        "U.S. Census Bureau TIGERweb",
                        org.civicsrepo.generated.dto.PopulationEstimateMeasure
                                .ANNUAL_GROWTH_RATE,
                        "Annual population growth rate",
                        "percent",
                        2025,
                        List.of(2020, 2021, 2022, 2023, 2024, 2025),
                        List.of(2021, 2022, 2023, 2024, 2025),
                        java.util.Map.of("type", "FeatureCollection", "features", List.of()),
                        List.of());

        response.priorYear(2024);

        given(
                        populationEstimatesService.findChoropleth(
                                "North Dakota",
                                org.civicsrepo.generated.dto.PopulationEstimateMeasure.ANNUAL_GROWTH_RATE,
                                2025))
                .willReturn(response);

        mockMvc.perform(get("/overlays/census/population-estimates"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.geography").value("North Dakota"))
                .andExpect(jsonPath("$.measure").value("ANNUAL_GROWTH_RATE"))
                .andExpect(jsonPath("$.year").value(2025))
                .andExpect(jsonPath("$.priorYear").value(2024))
                .andExpect(jsonPath("$.units").value("percent"));

        verify(populationEstimatesService)
                .findChoropleth(
                        "North Dakota",
                        org.civicsrepo.generated.dto.PopulationEstimateMeasure.ANNUAL_GROWTH_RATE,
                        2025);
    }

    @Test
    void bindsPopulationEstimateConfiguration() throws Exception {
        var response =
                new org.civicsrepo.generated.dto.PopulationEstimatesChoropleth(
                        "U.S. Census Bureau Population Estimates Program",
                        URI.create("https://example.test/co-est2025-alldata.csv"),
                        "U.S. Census Bureau Population Estimates Program",
                        "California",
                        2025,
                        "4f5a499d851e2cb48fd7a5405e5a9235453a8a66933657aacd10df0e264f35d5",
                        java.time.LocalDate.parse("2026-09-05"),
                        2025,
                        URI.create("https://example.test/tigerweb/2025/counties"),
                        "U.S. Census Bureau TIGERweb",
                        org.civicsrepo.generated.dto.PopulationEstimateMeasure.POPULATION,
                        "Resident population estimate",
                        "people",
                        2024,
                        List.of(2020, 2021, 2022, 2023, 2024, 2025),
                        List.of(2021, 2022, 2023, 2024, 2025),
                        java.util.Map.of("type", "FeatureCollection", "features", List.of()),
                        List.of());

        given(
                        populationEstimatesService.findChoropleth(
                                "California",
                                org.civicsrepo.generated.dto.PopulationEstimateMeasure.POPULATION,
                                2024))
                .willReturn(response);

        mockMvc.perform(get("/overlays/census/population-estimates")
                        .param("geography", "California")
                        .param("measure", "POPULATION")
                        .param("year", "2024"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.geography").value("California"))
                .andExpect(jsonPath("$.measure").value("POPULATION"))
                .andExpect(jsonPath("$.year").value(2024));

        verify(populationEstimatesService)
                .findChoropleth(
                        "California",
                        org.civicsrepo.generated.dto.PopulationEstimateMeasure.POPULATION,
                        2024);
    }

    @Test
    void returnsBadRequestForUnsupportedPopulationMeasureYear() throws Exception {
        given(
                        populationEstimatesService.findChoropleth(
                                "North Dakota",
                                org.civicsrepo.generated.dto.PopulationEstimateMeasure.ANNUAL_CHANGE,
                                2020))
                .willThrow(
                        new PopulationEstimatesService.InvalidQueryException(
                                "Year 2020 is not supported for population estimate measure ANNUAL_CHANGE."));

        mockMvc.perform(get("/overlays/census/population-estimates")
                        .param("measure", "ANNUAL_CHANGE")
                        .param("year", "2020"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("BAD_REQUEST"));
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

    @Test
    void proxiesHydrographyExportTilesAsPng() throws Exception {
        given(usgsHydrographyTileService.exportTile("-100,40,-99,41", 3857, 3857, "256,256", true))
                .willReturn(UsgsHydrographyTileService.TRANSPARENT_PNG);

        mockMvc.perform(get("/overlays/usgs/hydrography/export")
                        .param("bbox", "-100,40,-99,41")
                        .param("bboxSR", "3857")
                        .param("imageSR", "3857")
                        .param("size", "256,256")
                        .param("transparent", "true"))
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Type", "image/png"))
                .andExpect(header().exists("Cache-Control"));

        verify(usgsHydrographyTileService)
                .exportTile("-100,40,-99,41", 3857, 3857, "256,256", true);
    }

    @Test
    void proxiesTerrainExportTilesAsPng() throws Exception {
        byte[] terrainPng = new byte[] {(byte) 137, 80, 78, 71, 13, 10, 26, 10};
        given(usgsTerrainTileService.exportTile("-100,40,-99,41", "slope"))
                .willReturn(terrainPng);

        mockMvc.perform(get("/overlays/usgs/terrain/export")
                        .param("bbox", "-100,40,-99,41")
                        .param("mode", "slope"))
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Type", "image/png"))
                .andExpect(header().exists("Cache-Control"));

        verify(usgsTerrainTileService).exportTile("-100,40,-99,41", "slope");
    }

    @Test
    void serializesLodesFlowOverlay() throws Exception {
        given(lodesFlowService.findFlowSample("North Dakota"))
                .willReturn(new org.civicsrepo.generated.dto.LodesFlowOverlay(
                        "LEHD LODES 2023 main OD sample - North Dakota",
                        URI.create("https://lehd.ces.census.gov/data/lodes/LODES8/nd/od/nd_od_main_JT00_2023.csv.gz"),
                        "U.S. Census Bureau LEHD Origin-Destination Employment Statistics",
                        "North Dakota",
                        2023,
                        false,
                        java.util.Map.of("type", "FeatureCollection", "features", List.of()),
                        List.of(new org.civicsrepo.generated.dto.LodesFlowSummary(
                                "nd-burleigh-cass",
                                "Bismarck area (home)",
                                "Fargo area (work)",
                                1240,
                                "Burleigh County",
                                "Cass County"))));

        mockMvc.perform(get("/overlays/census/lodes-flow").param("geography", "North Dakota"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.geography").value("North Dakota"))
                .andExpect(jsonPath("$.flows[0].workerCount").value(1240));
    }

    @Test
    void returnsNotFoundForUnknownGeography() throws Exception {
        given(lodesFlowService.findFlowSample("Atlantis"))
                .willThrow(new IllegalArgumentException("Unknown geography: Atlantis"));

        mockMvc.perform(get("/overlays/census/lodes-flow").param("geography", "Atlantis"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NOT_FOUND"))
                .andExpect(jsonPath("$.message").value("Unknown geography: Atlantis"));
    }

    private UsgsEarthquakeOverlay overlay(double minMagnitude, int days) {
        return new UsgsEarthquakeOverlay(
                "USGS Earthquake Catalog",
                URI.create("https://earthquake.usgs.gov/"),
                "USGS",
                OffsetDateTime.parse("2026-01-01T00:00:00Z"),
                OffsetDateTime.parse("2026-01-02T00:00:00Z"),
                true,
                new UsgsEarthquakeQuery(minMagnitude, days, 45.93, 49.0, -104.05, -96.55),
                List.of(new UsgsEarthquakeFeature(
                        "nd-1",
                        "Western North Dakota",
                        2.8,
                        OffsetDateTime.parse("2026-01-01T00:00:00Z"),
                        47.9,
                        -103.2)));
    }
}
