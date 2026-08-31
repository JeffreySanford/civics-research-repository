package org.civicsrepo.admin;

import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.OffsetDateTime;
import java.util.List;
import org.civicsrepo.federation.CorpusProfile;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(CorpusProfileScaleController.class)
class CorpusProfileScaleControllerTest {
    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private CorpusProfileScaleService scaleService;

    @MockitoBean
    private CorpusScaleEvidenceService evidenceService;

    @Test
    void exposesNonMutatingHundredKEvidence() throws Exception {
        CorpusScaleEvidenceReport report = new CorpusScaleEvidenceReport(
                CorpusProfile.FEDERATED_100K,
                true,
                100_000L,
                100_000L,
                CorpusProfile.FEDERATED_100K,
                100_181L,
                "1".repeat(64),
                100_181,
                "1".repeat(64),
                true,
                true,
                100_181L,
                100_000L,
                "1".repeat(64),
                OffsetDateTime.parse("2026-08-31T01:11:17Z"),
                List.of());
        when(evidenceService.verify(CorpusProfile.FEDERATED_100K)).thenReturn(report);

        mockMvc.perform(get("/admin/corpus/scale/evidence").param("profile", "FEDERATED_100K"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.profile").value("FEDERATED_100K"))
                .andExpect(jsonPath("$.valid").value(true))
                .andExpect(jsonPath("$.retainedFederatedRecordCount").value(100_000))
                .andExpect(jsonPath("$.currentProjectionObjectCount").value(100_181))
                .andExpect(jsonPath("$.targetParity").value(true))
                .andExpect(jsonPath("$.violations").isEmpty());

        verify(evidenceService).verify(CorpusProfile.FEDERATED_100K);
    }
}
