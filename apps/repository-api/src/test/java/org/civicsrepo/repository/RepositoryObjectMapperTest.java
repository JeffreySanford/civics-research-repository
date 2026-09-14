package org.civicsrepo.repository;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.civicsrepo.generated.dto.FileFormat;
import org.civicsrepo.generated.dto.RepositorySource;
import org.civicsrepo.generated.dto.ResearchObjectDetail;
import org.civicsrepo.generated.dto.ResearchObjectOrigin;
import org.civicsrepo.generated.dto.ResearchObjectType;
import org.civicsrepo.generated.dto.ResearchProgram;
import org.civicsrepo.generated.dto.SearchResult;
import org.civicsrepo.generated.dto.SourceSystem;
import org.junit.jupiter.api.Test;

class RepositoryObjectMapperTest {
    private final RepositoryObjectMapper mapper = new RepositoryObjectMapper();

    @Test
    void mapsASeededRepositoryItemIntoASearchResult() {
        SearchResult result = mapper.toSearchResult(RepositoryFixtures.seededItem(
                "tiger-line-north-dakota-2025",
                "2025 TIGER/Line - Census Tracts - North Dakota",
                "TIGER_LINE",
                "North Dakota",
                "2025"));

        assertThat(result.getId()).isEqualTo("tiger-line-north-dakota-2025");
        assertThat(result.getTitle()).isEqualTo("2025 TIGER/Line - Census Tracts - North Dakota");
        assertThat(result.getContentType()).isEqualTo(ResearchObjectType.DATASET);
        assertThat(result.getProgram()).isEqualTo(ResearchProgram.TIGER_LINE);
        assertThat(result.getPublisher()).isEqualTo("U.S. Census Bureau");
        assertThat(result.getGeography()).isEqualTo("North Dakota");
        assertThat(result.getVintageYear()).isEqualTo(2025);
        assertThat(result.getSourceUrl().toString()).contains("www2.census.gov");
        assertThat(result.getOrigin()).isEqualTo(ResearchObjectOrigin.REPOSITORY);
        assertThat(result.getSourceSystem()).isEqualTo(SourceSystem.CENSUS);
    }

    @Test
    void mapsARepositoryItemIntoResearchObjectDetailMarkedAsRepositoryBacked() {
        ResearchObjectDetail detail = mapper.toResearchObjectDetail(
                RepositoryFixtures.seededItem(
                        "tiger-line-north-dakota-2025",
                        "2025 TIGER/Line - Census Tracts - North Dakota",
                        "TIGER_LINE",
                        "North Dakota",
                        "2025"),
                List.of());

        assertThat(detail.getSource()).isEqualTo(RepositorySource.REPOSITORY);
        assertThat(detail.getOrigin()).isEqualTo(ResearchObjectOrigin.REPOSITORY);
        assertThat(detail.getSourceSystem()).isEqualTo(SourceSystem.CENSUS);
        assertThat(detail.getReleasedOn()).isEqualTo(LocalDate.of(2025, 1, 1));
        assertThat(detail.getCitation()).startsWith("U.S. Census Bureau.");
        assertThat(detail.getFiles()).hasSize(2);
        assertThat(detail.getFiles().getFirst().getFormat()).isEqualTo(FileFormat.ZIP);
        assertThat(detail.getFiles().getLast().getFormat()).isEqualTo(FileFormat.PDF);
    }

    @Test
    void mapsRestrictedProfileInputsWithoutSyntheticFiles() {
        Map<String, String> metadata = new LinkedHashMap<>();
        metadata.put("dc.title", "LEHD Longitudinal Employer-Household Dynamics microdata");
        metadata.put("dc.publisher", "U.S. Census Bureau");
        metadata.put("dc.description.abstract", "Restricted LEHD microdata.");
        metadata.put("dc.coverage.spatial", "United States");
        metadata.put("crr.identifier.source", "lehd-microdata-restricted");
        metadata.put("crr.program", "LEHD");
        metadata.put("crr.geography.level", "National");
        metadata.put("crr.source.url", "https://www.census.gov/about/adrm/fsrdc.html");
        metadata.put("crr.documentation.url", "https://www.census.gov/about/adrm/fsrdc.html");
        metadata.put("crr.rights.access", "RESTRICTED");
        metadata.put("crr.access.mechanism", "FSRDC");
        metadata.put("crr.access.url", "https://www.census.gov/about/adrm/fsrdc.html");
        metadata.put(
                "crr.access.instructions",
                "Access requires an approved research proposal and Special Sworn Status through a Federal Statistical Research Data Center.");
        metadata.put("crr.access.restrictionbasis", "Title 13, U.S. Code");

        JsonNode item = RepositoryFixtures.item(
                "uuid-lehd-microdata-restricted",
                "LEHD Longitudinal Employer-Household Dynamics microdata",
                metadata);
        ObjectNode itemMetadata = (ObjectNode) item.path("metadata");
        var subjects = itemMetadata.putArray("dc.subject");
        subjects.addObject()
                .put("value", "LEHD")
                .put("language", "en_US")
                .putNull("authority")
                .put("confidence", -1);
        subjects.addObject()
                .put("value", "Restricted use")
                .put("language", "en_US")
                .putNull("authority")
                .put("confidence", -1);
        subjects.addObject()
                .put("value", "Title 13")
                .put("language", "en_US")
                .putNull("authority")
                .put("confidence", -1);
        subjects.addObject()
                .put("value", "Administrative records")
                .put("language", "en_US")
                .putNull("authority")
                .put("confidence", -1);

        ResearchObjectDetail detail = mapper.toResearchObjectDetail(item, List.of());

        assertThat(detail.getDocumentationUrl())
                .hasToString("https://www.census.gov/about/adrm/fsrdc.html");
        assertThat(detail.getGeographicLevel()).isEqualTo("National");
        assertThat(detail.getSubjects())
                .containsExactly("LEHD", "Restricted use", "Title 13", "Administrative records");
        assertThat(detail.getFiles()).isEmpty();

        assertThat(detail.getAccessGuidance()).isNotNull();
        assertThat(detail.getAccessGuidance().getMechanism()).isEqualTo("FSRDC");
        assertThat(detail.getAccessGuidance().getAccessUrl())
                .hasToString("https://www.census.gov/about/adrm/fsrdc.html");
        assertThat(detail.getAccessGuidance().getInstructions())
                .isEqualTo(
                        "Access requires an approved research proposal and Special Sworn Status through a Federal Statistical Research Data Center.");
        assertThat(detail.getAccessGuidance().getRestrictionBasis())
                .isEqualTo("Title 13, U.S. Code");
    }

    /** The source identifier is what the rest of the system addresses items by, not the DSpace UUID. */
    @Test
    void prefersTheSourceIdentifierOverTheDspaceUuid() {
        JsonNode item = RepositoryFixtures.seededItem("lodes-wac-texas-2023", "LODES Texas", "LODES", "Texas", "2023");

        assertThat(mapper.identifier(item)).isEqualTo("lodes-wac-texas-2023");
    }

    @Test
    void fallsBackToTheUuidForAnItemSyncHasNotStamped() {
        JsonNode item = RepositoryFixtures.item("raw-uuid", "Unsynced item", Map.of("dc.title", "Unsynced item"));

        assertThat(mapper.identifier(item)).isEqualTo("raw-uuid");
    }

    /** An unlabeled item must not be silently filed under a Census program. */
    @Test
    void reportsAnUnknownProgramAsOtherRatherThanGuessing() {
        JsonNode item = RepositoryFixtures.item("uuid", "Mystery item", Map.of("dc.title", "Mystery item"));

        SearchResult result = mapper.toSearchResult(item);
        assertThat(result.getProgram()).isEqualTo(ResearchProgram.OTHER);
        assertThat(result.getSourceSystem()).isEqualTo(SourceSystem.OTHER);
    }

    @Test
    void reportsAnUnrecognizedProgramValueAsOther() {
        JsonNode item = RepositoryFixtures.item(
                "uuid", "Item", Map.of("dc.title", "Item", "crr.program", "NOT_A_PROGRAM"));

        assertThat(mapper.toSearchResult(item).getProgram()).isEqualTo(ResearchProgram.OTHER);
    }

    @Test
    void normalizesProgramCasingAndSeparators() {
        JsonNode item =
                RepositoryFixtures.item("uuid", "Item", Map.of("dc.title", "Item", "crr.program", "tiger-line"));

        assertThat(mapper.toSearchResult(item).getProgram()).isEqualTo(ResearchProgram.TIGER_LINE);
    }

    @Test
    void derivesTheVintageFromTheIssuedDateWhenCrrVintageIsAbsent() {
        JsonNode item = RepositoryFixtures.item(
                "uuid", "Item", Map.of("dc.title", "Item", "dc.date.issued", "2019-06-01"));

        assertThat(mapper.toSearchResult(item).getVintageYear()).isEqualTo(2019);
    }

    @Test
    void toleratesAYearOnlyIssuedDate() {
        JsonNode item = RepositoryFixtures.item("uuid", "Item", Map.of("dc.title", "Item", "dc.date.issued", "2019"));

        assertThat(mapper.toResearchObjectDetail(item, List.of()).getReleasedOn()).isEqualTo(LocalDate.of(2019, 1, 1));
    }

    @Test
    void leavesTheReleaseDateEmptyRatherThanInventingOneForUnparseableInput() {
        JsonNode item = RepositoryFixtures.item(
                "uuid", "Item", Map.of("dc.title", "Item", "dc.date.issued", "sometime in 2019"));

        assertThat(mapper.toResearchObjectDetail(item, List.of()).getReleasedOn()).isNull();
    }

    @Test
    void producesNoFileManifestEntriesWhenTheItemCarriesNoUrls() {
        JsonNode item = RepositoryFixtures.item("uuid", "Item", Map.of("dc.title", "Item"));

        assertThat(mapper.toResearchObjectDetail(item, List.of()).getFiles()).isEmpty();
    }

    @Test
    void fallsBackToTheItemNameWhenDcTitleIsMissing() {
        JsonNode item = RepositoryFixtures.item("uuid", "Name only", Map.of("dc.publisher", "USGS"));

        assertThat(mapper.toSearchResult(item).getTitle()).isEqualTo("Name only");
    }
}
