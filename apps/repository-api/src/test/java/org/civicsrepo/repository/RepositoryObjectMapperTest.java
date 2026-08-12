package org.civicsrepo.repository;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import org.civicsrepo.datasets.DatasetDetail;
import org.civicsrepo.datasets.FileFormat;
import org.civicsrepo.search.ResearchObjectType;
import org.civicsrepo.search.ResearchProgram;
import org.civicsrepo.search.SearchResult;
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

        assertThat(result.id()).isEqualTo("tiger-line-north-dakota-2025");
        assertThat(result.title()).isEqualTo("2025 TIGER/Line - Census Tracts - North Dakota");
        assertThat(result.contentType()).isEqualTo(ResearchObjectType.DATASET);
        assertThat(result.program()).isEqualTo(ResearchProgram.TIGER_LINE);
        assertThat(result.publisher()).isEqualTo("U.S. Census Bureau");
        assertThat(result.geography()).isEqualTo("North Dakota");
        assertThat(result.vintageYear()).isEqualTo(2025);
        assertThat(result.sourceUrl()).contains("www2.census.gov");
    }

    @Test
    void mapsARepositoryItemIntoDatasetDetailMarkedAsRepositoryBacked() {
        DatasetDetail detail = mapper.toDatasetDetail(
                RepositoryFixtures.seededItem(
                        "tiger-line-north-dakota-2025",
                        "2025 TIGER/Line - Census Tracts - North Dakota",
                        "TIGER_LINE",
                        "North Dakota",
                        "2025"),
                List.of());

        assertThat(detail.source()).isEqualTo(RepositorySource.REPOSITORY);
        assertThat(detail.releasedOn()).isEqualTo(LocalDate.of(2025, 1, 1));
        assertThat(detail.citation()).startsWith("U.S. Census Bureau.");
        assertThat(detail.files()).hasSize(2);
        assertThat(detail.files().getFirst().format()).isEqualTo(FileFormat.ZIP);
        assertThat(detail.files().getLast().format()).isEqualTo(FileFormat.PDF);
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

        assertThat(mapper.toSearchResult(item).program()).isEqualTo(ResearchProgram.OTHER);
    }

    @Test
    void reportsAnUnrecognizedProgramValueAsOther() {
        JsonNode item = RepositoryFixtures.item(
                "uuid", "Item", Map.of("dc.title", "Item", "crr.program", "NOT_A_PROGRAM"));

        assertThat(mapper.toSearchResult(item).program()).isEqualTo(ResearchProgram.OTHER);
    }

    @Test
    void normalizesProgramCasingAndSeparators() {
        JsonNode item =
                RepositoryFixtures.item("uuid", "Item", Map.of("dc.title", "Item", "crr.program", "tiger-line"));

        assertThat(mapper.toSearchResult(item).program()).isEqualTo(ResearchProgram.TIGER_LINE);
    }

    @Test
    void derivesTheVintageFromTheIssuedDateWhenCrrVintageIsAbsent() {
        JsonNode item = RepositoryFixtures.item(
                "uuid", "Item", Map.of("dc.title", "Item", "dc.date.issued", "2019-06-01"));

        assertThat(mapper.toSearchResult(item).vintageYear()).isEqualTo(2019);
    }

    @Test
    void toleratesAYearOnlyIssuedDate() {
        JsonNode item = RepositoryFixtures.item("uuid", "Item", Map.of("dc.title", "Item", "dc.date.issued", "2019"));

        assertThat(mapper.toDatasetDetail(item, List.of()).releasedOn()).isEqualTo(LocalDate.of(2019, 1, 1));
    }

    @Test
    void leavesTheReleaseDateEmptyRatherThanInventingOneForUnparseableInput() {
        JsonNode item = RepositoryFixtures.item(
                "uuid", "Item", Map.of("dc.title", "Item", "dc.date.issued", "sometime in 2019"));

        assertThat(mapper.toDatasetDetail(item, List.of()).releasedOn()).isNull();
    }

    @Test
    void producesNoFileManifestEntriesWhenTheItemCarriesNoUrls() {
        JsonNode item = RepositoryFixtures.item("uuid", "Item", Map.of("dc.title", "Item"));

        assertThat(mapper.toDatasetDetail(item, List.of()).files()).isEmpty();
    }

    @Test
    void fallsBackToTheItemNameWhenDcTitleIsMissing() {
        JsonNode item = RepositoryFixtures.item("uuid", "Name only", Map.of("dc.publisher", "USGS"));

        assertThat(mapper.toSearchResult(item).title()).isEqualTo("Name only");
    }
}
