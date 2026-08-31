package org.civicsrepo.admin;

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
import org.civicsrepo.federation.FederatedCompositeCorpusProjectionEvidence;
import org.civicsrepo.federation.FederatedCompositeCorpusProjectionEvidenceStore;
import org.civicsrepo.federation.FederatedCompositeCorpusProjectionService;
import org.civicsrepo.generated.dto.RepositorySource;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(FederatedCompositeCorpusProjectionAdminController.class)
class FederatedCompositeCorpusProjectionAdminControllerTest {
    private static final String COMPOSITION_SHA = "a".repeat(64);
    private static final String PROJECTION_ID = "b".repeat(64);

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private FederatedCompositeCorpusProjectionService projectionService;

    @MockitoBean
    private FederatedCompositeCorpusProjectionEvidenceStore evidenceStore;

    @Test
    void projectsOneExactCompositionIdentity() throws Exception {
        FederatedCompositeCorpusProjectionEvidence evidence = evidence();
        given(projectionService.project(COMPOSITION_SHA)).willReturn(evidence);

        mockMvc.perform(post("/admin/federation/compositions/{sha}/project", COMPOSITION_SHA))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.compositionSha256").value(COMPOSITION_SHA))
                .andExpect(jsonPath("$.projectionId").value(PROJECTION_ID))
                .andExpect(jsonPath("$.federatedRecordCount").value(1_000_000))
                .andExpect(jsonPath("$.projectionObjectCount").value(1_000_181));

        verify(projectionService).project(COMPOSITION_SHA);
    }

    @Test
    void rejectsMalformedShaBeforeProjection() throws Exception {
        mockMvc.perform(post("/admin/federation/compositions/not-a-sha/project"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void mapsUnknownCompositionToNotFound() throws Exception {
        given(projectionService.project(COMPOSITION_SHA))
                .willThrow(new IllegalArgumentException("Unknown composite corpus composition SHA-256."));

        mockMvc.perform(post("/admin/federation/compositions/{sha}/project", COMPOSITION_SHA))
                .andExpect(status().isNotFound());
    }

    @Test
    void mapsUnstableCompositionToConflict() throws Exception {
        given(projectionService.project(COMPOSITION_SHA))
                .willThrow(new IllegalStateException("Composite source evidence changed after projection"));

        mockMvc.perform(post("/admin/federation/compositions/{sha}/project", COMPOSITION_SHA))
                .andExpect(status().isConflict());
    }

    @Test
    void resolvesLatestProjectionEvidenceForComposition() throws Exception {
        FederatedCompositeCorpusProjectionEvidence evidence = evidence();
        given(evidenceStore.findLatestByCompositionSha256(COMPOSITION_SHA)).willReturn(Optional.of(evidence));

        mockMvc.perform(get("/admin/federation/compositions/{sha}/projection", COMPOSITION_SHA))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.projectionId").value(PROJECTION_ID));
    }

    @Test
    void returnsNotFoundWhenCompositionHasNoProjectionEvidence() throws Exception {
        given(evidenceStore.findLatestByCompositionSha256(COMPOSITION_SHA)).willReturn(Optional.empty());

        mockMvc.perform(get("/admin/federation/compositions/{sha}/projection", COMPOSITION_SHA))
                .andExpect(status().isNotFound());
    }

    @Test
    void listsRecentProjectionEvidenceByProfile() throws Exception {
        FederatedCompositeCorpusProjectionEvidence evidence = evidence();
        given(evidenceStore.findRecent(CorpusProfile.FEDERATED_1M, 5)).willReturn(List.of(evidence));

        mockMvc.perform(get("/admin/federation/compositions/projections")
                        .param("corpusProfile", "FEDERATED_1M")
                        .param("limit", "5"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].compositionSha256").value(COMPOSITION_SHA))
                .andExpect(jsonPath("$[0].projectionId").value(PROJECTION_ID));
    }

    @Test
    void rejectsUnsafeProjectionHistoryBounds() throws Exception {
        mockMvc.perform(get("/admin/federation/compositions/projections")
                        .param("corpusProfile", "FEDERATED_1M")
                        .param("limit", "1001"))
                .andExpect(status().isBadRequest());
    }

    private FederatedCompositeCorpusProjectionEvidence evidence() {
        return new FederatedCompositeCorpusProjectionEvidence(
                COMPOSITION_SHA,
                CorpusProfile.FEDERATED_1M,
                1_000_000,
                PROJECTION_ID,
                RepositorySource.REPOSITORY,
                1_000_181,
                OffsetDateTime.parse("2026-08-31T20:30:00Z"),
                OffsetDateTime.parse("2026-08-31T20:31:00Z"));
    }
}
