package org.civicsrepo.research;

import static org.mockito.BDDMockito.given;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.net.URI;
import java.util.List;
import org.civicsrepo.generated.dto.AccessLevel;
import org.civicsrepo.generated.dto.ResearchObjectType;
import org.civicsrepo.metadata.ResearchMetadataProfile;
import org.civicsrepo.generated.dto.RepositorySource;
import org.civicsrepo.generated.dto.ResearchArtifactVersion;
import org.civicsrepo.generated.dto.ResearchArtifactVersionHistory;
import org.civicsrepo.generated.dto.VersionHistoryStatus;
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

    @Test
    void serializesObservedVersionKnowledgeWithoutInventingHistory() throws Exception {
        String token = "REFUQV9HT1Y6aHR0cHM6Ly9leGFtcGxlLmdvdg";
        ResearchArtifactVersion version = new ResearchArtifactVersion(
                        "DATA_GOV:https://example.gov", "Example research object")
                .current(true)
                .sourceUrl(URI.create("https://catalog.data.gov/dataset/example"));
        given(researchObjectService.getResearchObjectVersionHistory(token))
                .willReturn(new ResearchArtifactVersionHistory(
                                "DATA_GOV:https://example.gov",
                                VersionHistoryStatus.OBSERVED_CURRENT_ONLY,
                                List.of(version))
                        .note("Earlier or later history is unknown."));

        mockMvc.perform(get("/research/{researchId}/versions", token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("OBSERVED_CURRENT_ONLY"))
                .andExpect(jsonPath("$.versions.length()").value(1))
                .andExpect(jsonPath("$.versions[0].id").value("DATA_GOV:https://example.gov"))
                .andExpect(jsonPath("$.versions[0].current").value(true));
    }

    @Test
    void serializesCanonicalMetadataProfile() throws Exception {
        String token = "REFUQV9HT1Y6aHR0cHM6Ly9leGFtcGxlLmdvdg";

        ResearchMetadataProfile profile = new ResearchMetadataProfile(
                "lehd-microdata-restricted",
                ResearchObjectType.DATASET,
                "LEHD Longitudinal Employer-Household Dynamics microdata",
                "Restricted-use LEHD research metadata.",
                "U.S. Census Bureau",
                ResearchProgram.LEHD,
                "U.S. Census Bureau. LEHD microdata.",
                null,
                URI.create("https://www.census.gov/programs-surveys/ces/data/restricted-use-data.html"),
                URI.create("https://www.census.gov/about/adrm/fsrdc.html"),
                "United States",
                "National",
                2025,
                null,
                List.of("LEHD", "Restricted use", "Title 13"),
                List.of(),
                new ResearchMetadataProfile.Access(
                        AccessLevel.RESTRICTED,
                        "No confidential records are held by this repository.",
                        "Restricted under Title 13, U.S. Code. Not redistributable.",
                        null),
                List.of(),
                List.of(),
                null);

        given(researchObjectService.getResearchMetadataProfile(token))
                .willReturn(profile);

        mockMvc.perform(get("/research/{researchId}/metadata-profile", token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value("lehd-microdata-restricted"))
                .andExpect(jsonPath("$.type").value("DATASET"))
                .andExpect(jsonPath("$.program").value("LEHD"))
                .andExpect(jsonPath("$.access.level").value("RESTRICTED"))
                .andExpect(jsonPath("$.distributions.length()").value(0));
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
                        List.of(),
                        ResearchObjectOrigin.FEDERATED,
                        SourceSystem.DATA_GOV)
                .programName("Federal Highway Administration");
    }
}
