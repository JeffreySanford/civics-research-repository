package org.civicsrepo.admin;

import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.OffsetDateTime;
import java.util.List;
import org.civicsrepo.federation.FederatedBoundedSnapshotCaptureService;
import org.civicsrepo.federation.FederatedBoundedSnapshotManifest;
import org.civicsrepo.federation.FederatedBoundedSnapshotManifestStore;
import org.civicsrepo.federation.FederatedSourceSystem;
import org.civicsrepo.federation.HarvestRunStatus;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(FederationSnapshotAdminController.class)
class FederationSnapshotAdminControllerTest {
    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private FederatedBoundedSnapshotCaptureService captureService;

    @MockitoBean
    private FederatedBoundedSnapshotManifestStore manifestStore;

    @Test
    void capturesAndReturnsAPausedBoundedSnapshot() throws Exception {
        FederatedBoundedSnapshotManifest manifest = manifest("run-1", "a".repeat(64));
        given(captureService.capture("run-1")).willReturn(manifest);

        mockMvc.perform(post("/admin/federation/snapshots/runs/run-1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.mode").value("BOUNDED_SNAPSHOT"))
                .andExpect(jsonPath("$.runId").value("run-1"))
                .andExpect(jsonPath("$.runStatus").value("PAUSED"))
                .andExpect(jsonPath("$.retainedRecordCount").value(1_000))
                .andExpect(jsonPath("$.pageCount").value(10))
                .andExpect(jsonPath("$.cursor").value("opaque-after-token"));

        verify(captureService).capture("run-1");
    }

    @Test
    void capturesAnExactStablePrefixWhenRecordLimitIsProvided() throws Exception {
        FederatedBoundedSnapshotManifest manifest = manifest("run-500k", "b".repeat(64));
        given(captureService.capture("run-500k", 500_000L)).willReturn(manifest);

        mockMvc.perform(post("/admin/federation/snapshots/runs/run-500k").param("recordLimit", "500000"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.runId").value("run-500k"));

        verify(captureService).capture("run-500k", 500_000L);
    }

    @Test
    void rejectsSnapshotCaptureForAnInvalidRunState() throws Exception {
        given(captureService.capture("run-running"))
                .willThrow(new IllegalStateException("Bounded snapshots require a PAUSED or COMPLETED harvest run"));

        mockMvc.perform(post("/admin/federation/snapshots/runs/run-running"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void returnsRecentSnapshotsForOneSource() throws Exception {
        FederatedBoundedSnapshotManifest manifest = manifest("run-1", "a".repeat(64));
        given(manifestStore.findRecent(FederatedSourceSystem.DATA_GOV, 5)).willReturn(List.of(manifest));

        mockMvc.perform(get("/admin/federation/snapshots")
                        .param("sourceSystem", "DATA_GOV")
                        .param("limit", "5"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].snapshotId").value(manifest.snapshotId()))
                .andExpect(jsonPath("$[0].sourceSystem").value("DATA_GOV"));

        verify(manifestStore).findRecent(FederatedSourceSystem.DATA_GOV, 5);
    }

    @Test
    void rejectsUnsafeHistoryBounds() throws Exception {
        mockMvc.perform(get("/admin/federation/snapshots")
                        .param("sourceSystem", "DATA_GOV")
                        .param("limit", "1001"))
                .andExpect(status().isBadRequest());
    }

    private FederatedBoundedSnapshotManifest manifest(String runId, String sha256) {
        return new FederatedBoundedSnapshotManifest(
                "federated-bounded-snapshot/v1",
                FederatedBoundedSnapshotManifest.MODE,
                "DATA_GOV:" + sha256,
                runId,
                FederatedSourceSystem.DATA_GOV,
                "data-gov-catalog-v4-v2",
                List.of("data-gov-catalog-v4-v2"),
                HarvestRunStatus.PAUSED,
                1_000,
                1_000,
                0,
                0,
                "DATA_GOV:alpha",
                "DATA_GOV:zulu",
                sha256,
                OffsetDateTime.parse("2026-08-01T00:00:00Z"),
                OffsetDateTime.parse("2026-08-29T23:59:59Z"),
                100,
                10,
                "opaque-after-token",
                OffsetDateTime.parse("2026-08-30T12:00:00Z"),
                OffsetDateTime.parse("2026-08-30T12:04:00Z"),
                OffsetDateTime.parse("2026-08-30T12:05:00Z"));
    }
}
