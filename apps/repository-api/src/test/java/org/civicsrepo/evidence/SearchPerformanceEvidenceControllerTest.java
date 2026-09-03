package org.civicsrepo.evidence;

import static org.mockito.BDDMockito.given;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(SearchPerformanceEvidenceController.class)
class SearchPerformanceEvidenceControllerTest {
    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private SearchPerformanceEvidenceService evidenceService;

    @Test
    void returnsCertifiedSearchPerformanceEvidence() throws Exception {
        SearchPerformanceEvidence evidence = new SearchPerformanceEvidence(
                "FEDERATED_1M",
                "2026-09-03T19:06:00Z",
                "LOCAL_CERTIFIED_TOPOLOGY_ONLY",
                false,
                "a".repeat(64),
                1_000_181,
                1_000_000,
                true,
                "Scoped C2 claims only.",
                null,
                null,
                null,
                List.of(),
                List.of(),
                new SearchPerformanceEvidence.ResourceSummary(true, "Telemetry captured.", false, List.of()));
        given(evidenceService.latestEvidence()).willReturn(Optional.of(evidence));

        mockMvc.perform(get("/evidence/search-performance"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.profile").value("FEDERATED_1M"))
                .andExpect(jsonPath("$.projectionObjectCount").value(1_000_181))
                .andExpect(jsonPath("$.comparativeClaimAllowed").value(false))
                .andExpect(jsonPath("$.resources.counterResetDetected").value(false));
    }

    @Test
    void returnsNotFoundWhenNoCertifiedArtifactIsMounted() throws Exception {
        given(evidenceService.latestEvidence()).willReturn(Optional.empty());

        mockMvc.perform(get("/evidence/search-performance"))
                .andExpect(status().isNotFound());
    }
}
