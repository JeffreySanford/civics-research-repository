package org.civicsrepo.admin;

import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import org.civicsrepo.federation.CorpusProfile;
import org.civicsrepo.federation.FederatedCompositeCorpusManifest;
import org.civicsrepo.federation.FederatedCompositeCorpusManifestService;
import org.civicsrepo.federation.FederatedCompositeCorpusManifestStore;
import org.civicsrepo.federation.FederatedCompositeCorpusSource;
import org.civicsrepo.federation.FederatedSourceSystem;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(FederatedCompositeCorpusAdminController.class)
class FederatedCompositeCorpusAdminControllerTest {
    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private FederatedCompositeCorpusManifestService manifestService;

    @MockitoBean
    private FederatedCompositeCorpusManifestStore manifestStore;

    @Test
    void capturesCompositeEvidenceFromExplicitBoundedSnapshots() throws Exception {
        FederatedCompositeCorpusManifest manifest = manifest();
        given(manifestService.capture(eq(CorpusProfile.FEDERATED_1M), anyList())).willReturn(manifest);

        mockMvc.perform(post("/admin/federation/compositions")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "corpusProfile": "FEDERATED_1M",
                                  "sources": [
                                    {
                                      "sourceSystem": "DATA_GOV",
                                      "requestedRecordCount": 500000,
                                      "snapshotId": "DATA_GOV:%s"
                                    },
                                    {
                                      "sourceSystem": "DOE_OSTI",
                                      "requestedRecordCount": 500000,
                                      "snapshotId": "DOE_OSTI:%s"
                                    }
                                  ]
                                }
                                """.formatted("a".repeat(64), "b".repeat(64))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.mode").value("COMPOSITE_SNAPSHOT"))
                .andExpect(jsonPath("$.corpusProfile").value("FEDERATED_1M"))
                .andExpect(jsonPath("$.federatedRecordCount").value(1_000_000))
                .andExpect(jsonPath("$.sources[0].sourceSystem").value("DATA_GOV"))
                .andExpect(jsonPath("$.sources[1].sourceSystem").value("DOE_OSTI"));

        verify(manifestService).capture(eq(CorpusProfile.FEDERATED_1M), anyList());
    }

    @Test
    void mapsGuardedCaptureFailureToBadRequest() throws Exception {
        given(manifestService.capture(eq(CorpusProfile.FEDERATED_1M), anyList()))
                .willThrow(new IllegalArgumentException("Unknown bounded snapshot"));

        mockMvc.perform(post("/admin/federation/compositions")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "corpusProfile": "FEDERATED_1M",
                                  "sources": [
                                    {"sourceSystem":"DATA_GOV","requestedRecordCount":500000,"snapshotId":"DATA_GOV:%s"},
                                    {"sourceSystem":"DOE_OSTI","requestedRecordCount":500000,"snapshotId":"DOE_OSTI:%s"}
                                  ]
                                }
                                """.formatted("a".repeat(64), "b".repeat(64))))
                .andExpect(status().isBadRequest());
    }

    @Test
    void returnsRecentCompositionEvidenceForAProfile() throws Exception {
        FederatedCompositeCorpusManifest manifest = manifest();
        given(manifestStore.findRecent(CorpusProfile.FEDERATED_1M, 5)).willReturn(List.of(manifest));

        mockMvc.perform(get("/admin/federation/compositions")
                        .param("corpusProfile", "FEDERATED_1M")
                        .param("limit", "5"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].compositionSha256").value(manifest.compositionSha256()))
                .andExpect(jsonPath("$[0].sources.length()").value(2));

        verify(manifestStore).findRecent(CorpusProfile.FEDERATED_1M, 5);
    }

    @Test
    void resolvesAnExactCompositionSha() throws Exception {
        FederatedCompositeCorpusManifest manifest = manifest();
        given(manifestStore.findByCompositionSha256(manifest.compositionSha256())).willReturn(Optional.of(manifest));

        mockMvc.perform(get("/admin/federation/compositions/{sha}", manifest.compositionSha256()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.compositionSha256").value(manifest.compositionSha256()));
    }

    @Test
    void rejectsMalformedCompositionSha() throws Exception {
        mockMvc.perform(get("/admin/federation/compositions/{sha}", "not-a-sha"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void returnsNotFoundForUnknownCompositionSha() throws Exception {
        String unknown = "f".repeat(64);
        given(manifestStore.findByCompositionSha256(unknown)).willReturn(Optional.empty());

        mockMvc.perform(get("/admin/federation/compositions/{sha}", unknown))
                .andExpect(status().isNotFound());
    }

    @Test
    void rejectsUnsafeHistoryBounds() throws Exception {
        mockMvc.perform(get("/admin/federation/compositions")
                        .param("corpusProfile", "FEDERATED_1M")
                        .param("limit", "1001"))
                .andExpect(status().isBadRequest());
    }

    private FederatedCompositeCorpusManifest manifest() {
        OffsetDateTime capturedAt = OffsetDateTime.parse("2026-08-31T18:30:00Z");
        return new FederatedCompositeCorpusManifest(
                "federated-composition/v1",
                FederatedCompositeCorpusManifest.MODE,
                CorpusProfile.FEDERATED_1M,
                List.of(
                        source(FederatedSourceSystem.DATA_GOV, "a".repeat(64), "data-run-1", capturedAt),
                        source(FederatedSourceSystem.DOE_OSTI, "b".repeat(64), "osti-run-1", capturedAt)),
                1_000_000,
                "c".repeat(64),
                capturedAt);
    }

    private FederatedCompositeCorpusSource source(
            FederatedSourceSystem sourceSystem, String sha256, String runId, OffsetDateTime capturedAt) {
        return new FederatedCompositeCorpusSource(
                sourceSystem,
                500_000,
                sourceSystem.name() + ":" + sha256,
                runId,
                "adapter-v1",
                List.of("record-v1"),
                500_000,
                sha256,
                capturedAt);
    }
}
