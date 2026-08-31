package org.civicsrepo.admin;

import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import org.civicsrepo.federation.FederatedHarvestException;
import org.civicsrepo.federation.FederatedHarvestRunService;
import org.civicsrepo.federation.FederatedMetadataCatalog;
import org.civicsrepo.federation.FederatedSourceSystem;
import org.civicsrepo.federation.HarvestRun;
import org.civicsrepo.federation.HarvestRunStatus;
import org.civicsrepo.federation.HarvestRunStore;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(FederationHarvestAdminController.class)
class FederationHarvestAdminControllerTest {
    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private FederatedHarvestRunService harvestRunService;

    @MockitoBean
    private HarvestRunStore harvestRunStore;

    @MockitoBean
    private FederatedMetadataCatalog metadataCatalog;

    @Test
    void reportsTheExactRunAndCheckpointThatScaleGrowthWouldResume() throws Exception {
        HarvestRun paused = new HarvestRun(
                "run-data-gov-10k",
                FederatedSourceSystem.DATA_GOV,
                "data-gov-catalog-v4-v2",
                HarvestRunStatus.PAUSED,
                100,
                100,
                10_000,
                0,
                0,
                "10000",
                OffsetDateTime.parse("2026-08-30T17:00:00Z"),
                OffsetDateTime.parse("2026-08-30T17:23:18Z"),
                null,
                null);
        given(metadataCatalog.count(FederatedSourceSystem.DATA_GOV)).willReturn(10_000L);
        given(harvestRunStore.findResumable(FederatedSourceSystem.DATA_GOV)).willReturn(Optional.of(paused));
        given(harvestRunStore.findRecent(FederatedSourceSystem.DATA_GOV, 1)).willReturn(List.of(paused));

        mockMvc.perform(get("/admin/federation/harvest/status").param("sourceSystem", "DATA_GOV"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.sourceSystem").value("DATA_GOV"))
                .andExpect(jsonPath("$.retainedRecordCount").value(10_000))
                .andExpect(jsonPath("$.resumableRun.runId").value("run-data-gov-10k"))
                .andExpect(jsonPath("$.resumableRun.status").value("PAUSED"))
                .andExpect(jsonPath("$.resumableRun.pageSize").value(100))
                .andExpect(jsonPath("$.resumableRun.pageCount").value(100))
                .andExpect(jsonPath("$.resumableRun.acceptedCount").value(10_000))
                .andExpect(jsonPath("$.resumableRun.cursor").value("10000"))
                .andExpect(jsonPath("$.latestRun.runId").value("run-data-gov-10k"));
    }

    @Test
    void defaultsHarvestStatusToDataGovAndAllowsNoExistingRun() throws Exception {
        given(metadataCatalog.count(FederatedSourceSystem.DATA_GOV)).willReturn(0L);
        given(harvestRunStore.findResumable(FederatedSourceSystem.DATA_GOV)).willReturn(Optional.empty());
        given(harvestRunStore.findRecent(FederatedSourceSystem.DATA_GOV, 1)).willReturn(List.of());

        mockMvc.perform(get("/admin/federation/harvest/status"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.sourceSystem").value("DATA_GOV"))
                .andExpect(jsonPath("$.retainedRecordCount").value(0))
                .andExpect(jsonPath("$.resumableRun").doesNotExist())
                .andExpect(jsonPath("$.latestRun").doesNotExist());
    }

    @Test
    void runsOneBoundedDataGovPageAndReturnsDurableEvidence() throws Exception {
        HarvestRun paused = new HarvestRun(
                "run-data-gov-1",
                FederatedSourceSystem.DATA_GOV,
                "data-gov-ckan-v1",
                HarvestRunStatus.PAUSED,
                1_000,
                1,
                998,
                2,
                0,
                "1000",
                OffsetDateTime.parse("2026-08-30T15:40:00Z"),
                OffsetDateTime.parse("2026-08-30T15:40:04Z"),
                null,
                null);
        given(harvestRunService.runBounded(FederatedSourceSystem.DATA_GOV, 1_000, 1)).willReturn(paused);

        mockMvc.perform(post("/admin/federation/harvest")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "sourceSystem": "DATA_GOV",
                                  "pageSize": 1000,
                                  "maxPages": 1
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.runId").value("run-data-gov-1"))
                .andExpect(jsonPath("$.sourceSystem").value("DATA_GOV"))
                .andExpect(jsonPath("$.status").value("PAUSED"))
                .andExpect(jsonPath("$.pageCount").value(1))
                .andExpect(jsonPath("$.acceptedCount").value(998))
                .andExpect(jsonPath("$.rejectedCount").value(2))
                .andExpect(jsonPath("$.cursor").value("1000"))
                .andExpect(jsonPath("$.projectionRefreshRequired").value(true));

        verify(harvestRunService).runBounded(FederatedSourceSystem.DATA_GOV, 1_000, 1);
    }

    @Test
    void restartUsesExplicitRestartFromBeginningSemantics() throws Exception {
        HarvestRun paused = new HarvestRun(
                "run-data-gov-new",
                FederatedSourceSystem.DATA_GOV,
                "data-gov-ckan-v1",
                HarvestRunStatus.PAUSED,
                500,
                1,
                500,
                0,
                0,
                "500",
                OffsetDateTime.parse("2026-08-30T15:45:00Z"),
                OffsetDateTime.parse("2026-08-30T15:45:03Z"),
                null,
                null);
        given(harvestRunService.restartFromBeginning(FederatedSourceSystem.DATA_GOV, 500, 1))
                .willReturn(paused);

        mockMvc.perform(post("/admin/federation/harvest/restart")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "sourceSystem": "DATA_GOV",
                                  "pageSize": 500,
                                  "maxPages": 1
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.runId").value("run-data-gov-new"))
                .andExpect(jsonPath("$.acceptedCount").value(500));

        verify(harvestRunService).restartFromBeginning(FederatedSourceSystem.DATA_GOV, 500, 1);
    }

    @Test
    void rejectsUnsafeBoundsBeforeInvokingTheHarvester() throws Exception {
        mockMvc.perform(post("/admin/federation/harvest")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "sourceSystem": "DATA_GOV",
                                  "pageSize": 10001,
                                  "maxPages": 1
                                }
                                """))
                .andExpect(status().isBadRequest());

        verifyNoInteractions(harvestRunService);
    }

    @Test
    void mapsUnknownOrUnconfiguredSourceToBadRequest() throws Exception {
        given(harvestRunService.runBounded(FederatedSourceSystem.DOE_OSTI, 100, 1))
                .willThrow(new IllegalArgumentException("No harvester registered for DOE_OSTI"));

        mockMvc.perform(post("/admin/federation/harvest")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "sourceSystem": "DOE_OSTI",
                                  "pageSize": 100,
                                  "maxPages": 1
                                }
                                """))
                .andExpect(status().isBadRequest());
    }

    @Test
    void mapsExhaustedPublisherFailureToBadGateway() throws Exception {
        given(harvestRunService.runBounded(FederatedSourceSystem.DATA_GOV, 1_000, 1))
                .willThrow(FederatedHarvestException.retryable("Data.gov harvest request failed."));

        mockMvc.perform(post("/admin/federation/harvest")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "sourceSystem": "DATA_GOV",
                                  "pageSize": 1000,
                                  "maxPages": 1
                                }
                                """))
                .andExpect(status().isBadGateway());
    }
}
