package org.civicsrepo.research;

import static org.mockito.BDDMockito.given;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.net.URI;
import java.util.List;
import org.civicsrepo.generated.dto.RepositorySource;
import org.civicsrepo.generated.dto.ResearchObjectDetail;
import org.civicsrepo.generated.dto.ResearchObjectOrigin;
import org.civicsrepo.generated.dto.ResearchProgram;
import org.civicsrepo.generated.dto.SourceSystem;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(ResearchObjectController.class)
class ResearchObjectControllerTest {
    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private ResearchObjectService researchObjectService;

    @Test
    void serializesFederatedAuthorityProvenance() throws Exception {
        String token = "REFUQV9HT1Y6aHR0cHM6Ly9leGFtcGxlLmdvdg";
        given(researchObjectService.getResearchObject(token)).willReturn(detail());

        mockMvc.perform(get("/research/{researchId}", token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.source").value("FEDERATED"))
                .andExpect(jsonPath("$.origin").value("FEDERATED"))
                .andExpect(jsonPath("$.sourceSystem").value("DATA_GOV"))
                .andExpect(jsonPath("$.program").value("OTHER"))
                .andExpect(jsonPath("$.programName").value("Federal Highway Administration"))
                .andExpect(jsonPath("$.files.length()").value(0));
    }

    private ResearchObjectDetail detail() {
        return new ResearchObjectDetail(
                        RepositorySource.FEDERATED,
                        "DATA_GOV:https://example.gov",
                        "Example research object",
                        ResearchProgram.OTHER,
                        "U.S. Department of Transportation",
                        "Federated metadata.",
                        List.of(),
                        "Example research object",
                        URI.create("https://catalog.data.gov/dataset/example"),
                        List.of(),
                        ResearchObjectOrigin.FEDERATED,
                        SourceSystem.DATA_GOV)
                .programName("Federal Highway Administration");
    }
}
