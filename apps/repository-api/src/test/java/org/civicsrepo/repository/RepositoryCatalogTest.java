package org.civicsrepo.repository;

import org.civicsrepo.generated.dto.RepositorySource;
import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.List;
import org.civicsrepo.datasets.DatasetDetail;
import org.civicsrepo.dspace.DspaceRestClient;
import org.civicsrepo.dspace.DspaceUnavailableException;
import org.civicsrepo.search.SearchResult;
import org.junit.jupiter.api.Test;

class RepositoryCatalogTest {
    private static final String BASE_URL = "http://localhost:8081/server";

    private final RepositoryObjectMapper mapper = new RepositoryObjectMapper();

    private static final List<JsonNode> ITEMS = List.of(
            RepositoryFixtures.seededItem(
                    "tiger-line-north-dakota-2025",
                    "2025 TIGER/Line - Census Tracts - North Dakota",
                    "TIGER_LINE",
                    "North Dakota",
                    "2025"),
            RepositoryFixtures.seededItem(
                    "lodes-wac-north-dakota-2023",
                    "2023 LODES Workplace Area Characteristics - North Dakota",
                    "LODES",
                    "North Dakota",
                    "2023"),
            RepositoryFixtures.seededItem(
                    "tiger-line-texas-2025", "2025 TIGER/Line - Census Tracts - Texas", "TIGER_LINE", "Texas", "2025"));

    @Test
    void listsEveryRepositoryItemSortedByTitle() {
        List<SearchResult> results = catalog(ITEMS).findAllResearchObjects();

        assertThat(results).extracting(SearchResult::id).containsExactly(
                "lodes-wac-north-dakota-2023", "tiger-line-north-dakota-2025", "tiger-line-texas-2025");
    }

    @Test
    void findsADatasetBySourceIdentifier() {
        DatasetDetail detail = catalog(ITEMS).findDataset("tiger-line-north-dakota-2025").orElseThrow();

        assertThat(detail.source()).isEqualTo(RepositorySource.REPOSITORY);
        assertThat(detail.geography()).isEqualTo("North Dakota");
    }

    @Test
    void matchesDatasetIdentifiersCaseInsensitively() {
        assertThat(catalog(ITEMS).findDataset("TIGER-LINE-TEXAS-2025")).isPresent();
    }

    @Test
    void reportsAnUnknownDatasetAsAbsentRatherThanGuessing() {
        assertThat(catalog(ITEMS).findDataset("no-such-dataset")).isEmpty();
    }

    /** Related research is computed from the repository, so it reflects what is actually held. */
    /**
     * Program alone is not a relationship worth showing: with 52 areas per program it fills the
     * list with alphabetically adjacent states.
     */
    @Test
    void relatesItemsSharingGeographyAndExcludesSameProgramFiller() {
        DatasetDetail detail = catalog(ITEMS).findDataset("tiger-line-north-dakota-2025").orElseThrow();

        assertThat(detail.relatedResearch())
                .extracting(SearchResult::id)
                .containsExactly("lodes-wac-north-dakota-2023")
                .doesNotContain("tiger-line-texas-2025");
    }

    /** National items share no geography, so program is the only relationship available. */
    @Test
    void fallsBackToProgramWhenNothingSharesTheGeography() {
        List<JsonNode> items = List.of(
                RepositoryFixtures.seededItem("cps-a", "CPS A", "CPS", "United States", "2024"),
                RepositoryFixtures.seededItem("cps-b", "CPS B", "CPS", "United States", "2023"),
                ITEMS.getFirst());

        DatasetDetail detail = catalog(items).findDataset("cps-a").orElseThrow();

        assertThat(detail.relatedResearch()).extracting(SearchResult::id).containsExactly("cps-b");
    }

    @Test
    void omitsUnrelatedItemsFromRelatedResearch() {
        List<JsonNode> items = List.of(
                ITEMS.getFirst(),
                RepositoryFixtures.seededItem("cps-public-use", "CPS Public Use Data", "CPS", "United States", "2024"));

        DatasetDetail detail = catalog(items).findDataset("tiger-line-north-dakota-2025").orElseThrow();

        assertThat(detail.relatedResearch()).isEmpty();
    }

    @Test
    void reportsAnEmptyCatalogWhenDspaceIsNotConfigured() {
        RepositoryCatalog catalog =
                new RepositoryCatalog(new DspaceRestClient("", "", ""), mapper, 500, 0);

        assertThat(catalog.isAvailable()).isFalse();
        assertThat(catalog.findAllResearchObjects()).isEmpty();
        assertThat(catalog.findDataset("tiger-line-north-dakota-2025")).isEmpty();
    }

    /** Reads degrade to empty so callers can fall back to labelled fixtures instead of erroring. */
    @Test
    void reportsAnEmptyCatalogWhenDspaceIsUnreachable() {
        RepositoryCatalog catalog = new RepositoryCatalog(
                new DspaceRestClient(BASE_URL, "", "") {
                    @Override
                    public List<JsonNode> listAllItems(int maxItems) {
                        throw new DspaceUnavailableException(BASE_URL, new java.io.IOException("refused"));
                    }
                },
                mapper,
                500,
                0);

        assertThat(catalog.findAllResearchObjects()).isEmpty();
    }

    private RepositoryCatalog catalog(List<JsonNode> items) {
        return new RepositoryCatalog(
                new DspaceRestClient(BASE_URL, "", "") {
                    @Override
                    public List<JsonNode> listAllItems(int maxItems) {
                        return items;
                    }
                },
                mapper,
                500,
                0);
    }
}
