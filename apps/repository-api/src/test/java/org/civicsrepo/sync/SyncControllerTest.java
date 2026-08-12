package org.civicsrepo.sync;

import org.civicsrepo.generated.dto.SyncAction;
import org.civicsrepo.generated.dto.SyncJob;
import org.civicsrepo.generated.dto.SyncMode;
import org.civicsrepo.generated.dto.SyncRequest;
import org.civicsrepo.generated.dto.SyncSource;
import org.civicsrepo.generated.dto.SyncStatus;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(SyncController.class)
class SyncControllerTest {
    private static final UUID JOB_ID = UUID.fromString("00000000-0000-4000-8000-000000000001");

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private SyncService syncService;

    @Test
    void acceptsAValidSyncRequestAndReturnsThePlannedJob() throws Exception {
        given(syncService.runSync(new SyncRequest(SyncMode.DRY_RUN, SyncSource.TIGER_LINE)))
                .willReturn(job(SyncMode.DRY_RUN, SyncStatus.DRY_RUN_COMPLETE));

        mockMvc.perform(post("/admin/sync")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"mode\":\"DRY_RUN\",\"source\":\"TIGER_LINE\"}"))
                .andExpect(status().isAccepted())
                .andExpect(jsonPath("$.id").value(JOB_ID.toString()))
                .andExpect(jsonPath("$.status").value("DRY_RUN_COMPLETE"))
                .andExpect(jsonPath("$.actions[0].actionType").value("UPSERT_ITEM"));
    }

    @Test
    void rejectsARequestMissingTheMode() throws Exception {
        mockMvc.perform(post("/admin/sync")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"source\":\"TIGER_LINE\"}"))
                .andExpect(status().isBadRequest());

        verify(syncService, never()).runSync(any());
    }

    @Test
    void rejectsAnUnknownSyncMode() throws Exception {
        mockMvc.perform(post("/admin/sync")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"mode\":\"DESTROY\",\"source\":\"TIGER_LINE\"}"))
                .andExpect(status().isBadRequest());

        verify(syncService, never()).runSync(any());
    }

    @Test
    void rejectsAnUnknownSyncSource() throws Exception {
        mockMvc.perform(post("/admin/sync")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"mode\":\"APPLY\",\"source\":\"NOT_A_SOURCE\"}"))
                .andExpect(status().isBadRequest());

        verify(syncService, never()).runSync(any());
    }

    @Test
    void listsRecentSyncJobs() throws Exception {
        given(syncService.findRecentJobs())
                .willReturn(List.of(job(SyncMode.APPLY, SyncStatus.APPLIED)));

        mockMvc.perform(get("/admin/sync"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].mode").value("APPLY"))
                .andExpect(jsonPath("$[0].status").value("APPLIED"));
    }

    @Test
    void returnsNotFoundForAnUnknownSyncJob() throws Exception {
        given(syncService.findJob("missing")).willReturn(Optional.empty());

        mockMvc.perform(get("/admin/sync/missing")).andExpect(status().isNotFound());
    }

    @Test
    void returnsASyncJobById() throws Exception {
        given(syncService.findJob(JOB_ID.toString())).willReturn(Optional.of(job(SyncMode.DIFF, SyncStatus.DIFF_COMPLETE)));

        mockMvc.perform(get("/admin/sync/" + JOB_ID))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(JOB_ID.toString()))
                .andExpect(jsonPath("$.status").value("DIFF_COMPLETE"));
    }

    private SyncJob job(SyncMode mode, SyncStatus status) {
        return new SyncJob(
                JOB_ID,
                mode,
                SyncSource.TIGER_LINE,
                status,
                OffsetDateTime.parse("2026-01-01T00:00:00Z"),
                List.of(new SyncAction(
                        SyncAction.ActionTypeEnum.UPSERT_ITEM, "2025 TIGER/Line - Census Tracts - North Dakota", "Prepared.")))
                        .completedAt(OffsetDateTime.parse("2026-01-01T00:00:05Z"));
    }
}
