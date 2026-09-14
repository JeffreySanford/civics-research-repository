package org.civicsrepo.repository;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.civicsrepo.dspace.DspaceManagedFields;
import org.civicsrepo.dspace.DspaceRestClient;
import org.civicsrepo.dspace.DspaceRestClient.DspaceVersionRecord;
import org.civicsrepo.dspace.DspaceUnavailableException;
import org.civicsrepo.generated.dto.RepositorySource;
import org.civicsrepo.generated.dto.ResearchArtifactVersion;
import org.civicsrepo.generated.dto.ResearchObjectDetail;
import org.civicsrepo.generated.dto.SearchResult;
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

        assertThat(results).extracting(SearchResult::getId).containsExactly(
                "lodes-wac-north-dakota-2023", "tiger-line-north-dakota-2025", "tiger-line-texas-2025");
    }

    @Test
    void findsADatasetBySourceIdentifier() {
        ResearchObjectDetail detail = catalog(ITEMS).findDataset("tiger-line-north-dakota-2025").orElseThrow();

        assertThat(detail.getSource()).isEqualTo(RepositorySource.REPOSITORY);
        assertThat(detail.getGeography()).isEqualTo("North Dakota");
    }

    @Test
    void matchesDatasetIdentifiersCaseInsensitively() {
        assertThat(catalog(ITEMS).findDataset("TIGER-LINE-TEXAS-2025")).isPresent();
    }

    @Test
    void reportsAnUnknownDatasetAsAbsentRatherThanGuessing() {
        assertThat(catalog(ITEMS).findDataset("no-such-dataset")).isEmpty();
    }

    @Test
    void singletonDspaceHistoryRemainsObservedCurrentOnlyAndPreservesSourceVersionEvidence() {
        String id = "artifact-2025";
        JsonNode currentItem = versionedItem(id, "Observed artifact", "TIGER2025");
        List<DspaceVersionRecord> versions = List.of(new DspaceVersionRecord(
                "101", "1", "2026-09-13T10:00:00.000", "Initial repository version", true, currentItem));

        List<ResearchArtifactVersion> history =
                catalog(List.of(currentItem), versions).findObservedVersionHistory(id);

        assertThat(history).singleElement().satisfies(version -> {
            assertThat(version.getId()).isEqualTo(id);
            assertThat(version.getCurrent()).isTrue();
            assertThat(version.getVersionLabel()).isEqualTo("TIGER2025");
            assertThat(version.getSupersedes()).isNull();
        });
    }

    @Test
    void noDspaceHistoryRemainsObservedCurrentOnlyWithoutManufacturingLineage() {
        String id = "artifact-2025";
        JsonNode currentItem = versionedItem(id, "Observed artifact", "TIGER2025");

        List<ResearchArtifactVersion> history =
                catalog(List.of(currentItem), List.of()).findObservedVersionHistory(id);

        assertThat(history).singleElement().satisfies(version -> {
            assertThat(version.getId()).isEqualTo(id);
            assertThat(version.getVersionLabel()).isEqualTo("TIGER2025");
            assertThat(version.getIsVersionOf()).isNull();
            assertThat(version.getSupersedes()).isNull();
        });
    }

    @Test
    void mapsMultipleObservedDspaceVersionsIntoRepositoryNativeLineage() {
        String id = "artifact-2025";
        JsonNode currentItem = versionedItem(id, "Observed artifact", "TIGER2025");
        JsonNode previousItem = versionedItem(id, "Observed artifact", "TIGER2024");
        List<DspaceVersionRecord> versions = List.of(
                new DspaceVersionRecord(
                        "102", "2", "2026-09-13T10:00:00.000", "Updated source capture", true, currentItem),
                new DspaceVersionRecord(
                        "101", "1", "2026-08-13T10:00:00.000", "Initial repository capture", false, previousItem));

        List<ResearchArtifactVersion> history =
                catalog(List.of(currentItem), versions).findObservedVersionHistory(id);

        assertThat(history).hasSize(2);
        assertThat(history).extracting(ResearchArtifactVersion::getId)
                .containsExactly("dspace-version:102", "dspace-version:101");
        assertThat(history).extracting(ResearchArtifactVersion::getVersionLabel)
                .containsExactly("Repository version 2", "Repository version 1");
        assertThat(history).extracting(ResearchArtifactVersion::getCurrent)
                .containsExactly(true, false);
        assertThat(history.getFirst().getIsVersionOf()).isEqualTo(id);
        assertThat(history.getFirst().getSupersedes()).isEqualTo("dspace-version:101");
        assertThat(history.get(1).getSupersedes()).isNull();
    }

    /** Related research is computed from the repository, so it reflects what is actually held. */
    /**
     * Program alone is not a relationship worth showing: with 52 areas per program it fills the
     * list with alphabetically adjacent states.
     */
    @Test
    void relatesItemsSharingGeographyAndExcludesSameProgramFiller() {
        ResearchObjectDetail detail = catalog(ITEMS).findDataset("tiger-line-north-dakota-2025").orElseThrow();

        assertThat(detail.getRelatedResearch())
                .extracting(SearchResult::getId)
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

        ResearchObjectDetail detail = catalog(items).findDataset("cps-a").orElseThrow();

        assertThat(detail.getRelatedResearch()).extracting(SearchResult::getId).containsExactly("cps-b");
    }

    @Test
    void omitsUnrelatedItemsFromRelatedResearch() {
        List<JsonNode> items = List.of(
                ITEMS.getFirst(),
                RepositoryFixtures.seededItem("cps-public-use", "CPS Public Use Data", "CPS", "United States", "2024"));

        ResearchObjectDetail detail = catalog(items).findDataset("tiger-line-north-dakota-2025").orElseThrow();

        assertThat(detail.getRelatedResearch()).isEmpty();
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

    private JsonNode versionedItem(String sourceIdentifier, String title, String sourceVersion) {
        Map<String, String> metadata = new LinkedHashMap<>();
        metadata.put("dc.title", title);
        metadata.put("crr.identifier.source", sourceIdentifier);
        metadata.put(DspaceManagedFields.VERSION_LABEL_FIELD, sourceVersion);
        metadata.put(DspaceManagedFields.SOURCE_URL_FIELD, "https://example.gov/" + sourceVersion);
        return RepositoryFixtures.item("uuid-" + sourceIdentifier, title, metadata);
    }

    private RepositoryCatalog catalog(List<JsonNode> items) {
        return catalog(items, List.of());
    }

    private RepositoryCatalog catalog(List<JsonNode> items, List<DspaceVersionRecord> versions) {
        return new RepositoryCatalog(
                new DspaceRestClient(BASE_URL, "", "") {
                    @Override
                    public List<JsonNode> listAllItems(int maxItems) {
                        return items;
                    }

                    @Override
                    public List<DspaceVersionRecord> listItemVersions(String itemUuid) {
                        return versions;
                    }
                },
                mapper,
                500,
                0);
    }
}
