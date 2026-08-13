package org.civicsrepo.evidence;

import static org.mockito.BDDMockito.given;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.OffsetDateTime;
import java.util.List;
import org.civicsrepo.generated.dto.AccessibilityEvidence;
import org.civicsrepo.generated.dto.EvidenceStatus;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(AccessibilityEvidenceController.class)
class AccessibilityEvidenceControllerTest {
    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private AccessibilityEvidenceService evidenceService;

    @Test
    void returnsAccessibilityEvidenceSummaries() throws Exception {
        given(evidenceService.listEvidence())
                .willReturn(List.of(
                        new AccessibilityEvidence(
                                        "axe-wcag-2026-08-12",
                                        "axe-core scans (6 routes)",
                                        EvidenceStatus.AUTOMATED_PASS,
                                        AccessibilityEvidence.StandardEnum.WCAG_2_1_AA,
                                        OffsetDateTime.parse("2026-08-12T00:00:00Z"))
                                .notes("57 checks passed."),
                        new AccessibilityEvidence(
                                        "nvda-checklist",
                                        "NVDA smoke test (N1–N20)",
                                        EvidenceStatus.NOT_STARTED,
                                        AccessibilityEvidence.StandardEnum.WCAG_2_1_AA,
                                        OffsetDateTime.parse("2026-08-12T00:00:00Z"))
                                .notes("Not run.")));

        mockMvc.perform(get("/accessibility/evidence"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value("axe-wcag-2026-08-12"))
                .andExpect(jsonPath("$[0].status").value("AUTOMATED_PASS"))
                .andExpect(jsonPath("$[1].status").value("NOT_STARTED"));
    }
}
