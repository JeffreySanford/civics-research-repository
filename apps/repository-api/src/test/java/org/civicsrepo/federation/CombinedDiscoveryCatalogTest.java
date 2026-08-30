package org.civicsrepo.federation;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.net.URI;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.civicsrepo.generated.dto.ResearchObjectOrigin;
import org.civicsrepo.generated.dto.ResearchObjectType;
import org.civicsrepo.generated.dto.ResearchProgram;
import org.civicsrepo.generated.dto.SearchResult;
import org.civicsrepo.generated.dto.SourceSystem;
import org.civicsrepo.search.DiscoveryDocument;
import org.junit.jupiter.api.Test;

class CombinedDiscoveryCatalogTest {
    @Test
    void pagesRepositoryThenFederatedRecordsWithoutMaterializingFederatedCorpus() {
        RecordingCatalog federated = new RecordingCatalog(List.of(
                record("001", "Office of Science"),
                record("002", "Office of Science"),
                record("003", "Energy Efficiency")));
        CombinedDiscoveryCatalog catalog = new CombinedDiscoveryCatalog(
                () -> List.of(repositoryDocument("repo-1"), repositoryDocument("repo-2")),
                federated,
                new FederatedDiscoveryDocumentMapper());

        CombinedDiscoveryCatalog.DiscoveryPage first = catalog.findAfter(null, 2);
        assertEquals(List.of("repo-1", "repo-2"), ids(first));
        assertFalse(first.complete());
        assertEquals(2, first.nextCursor().repositoryOffset());
        assertNull(first.nextCursor().federatedAfterId());

        CombinedDiscoveryCatalog.DiscoveryPage second = catalog.findAfter(first.nextCursor(), 2);
        assertEquals(List.of("DOE_OSTI:001", "DOE_OSTI:002"), ids(second));
        assertFalse(second.complete());
        assertEquals("DOE_OSTI:002", second.nextCursor().federatedAfterId());

        CombinedDiscoveryCatalog.DiscoveryPage third = catalog.findAfter(second.nextCursor(), 2);
        assertEquals(List.of("DOE_OSTI:003"), ids(third));
        assertTrue(third.complete());
        assertNull(third.nextCursor());
        assertEquals("Energy Efficiency", third.documents().getFirst().programName());

        assertEquals(List.of(2, 2), federated.requestedLimits);
        assertEquals(3, catalog.retainedFederatedCount());
    }

    @Test
    void continuesRepositoryPagingBeforeReadingFederatedCatalog() {
        RecordingCatalog federated = new RecordingCatalog(List.of(record("001", "Program")));
        CombinedDiscoveryCatalog catalog = new CombinedDiscoveryCatalog(
                () -> List.of(
                        repositoryDocument("repo-1"),
                        repositoryDocument("repo-2"),
                        repositoryDocument("repo-3")),
                federated,
                new FederatedDiscoveryDocumentMapper());

        CombinedDiscoveryCatalog.DiscoveryPage first = catalog.findAfter(null, 2);
        assertEquals(List.of("repo-1", "repo-2"), ids(first));
        assertTrue(federated.requestedLimits.isEmpty());

        CombinedDiscoveryCatalog.DiscoveryPage second = catalog.findAfter(first.nextCursor(), 2);
        assertEquals(List.of("repo-3", "DOE_OSTI:001"), ids(second));
        assertFalse(second.complete());
        assertEquals(List.of(1), federated.requestedLimits);

        CombinedDiscoveryCatalog.DiscoveryPage finalPage = catalog.findAfter(second.nextCursor(), 2);
        assertTrue(finalPage.documents().isEmpty());
        assertTrue(finalPage.complete());
    }

    private static List<String> ids(CombinedDiscoveryCatalog.DiscoveryPage page) {
        return page.documents().stream().map((document) -> document.result().getId()).toList();
    }

    private static DiscoveryDocument repositoryDocument(String id) {
        SearchResult result = new SearchResult(
                id,
                "Repository " + id,
                ResearchObjectType.DATASET,
                ResearchProgram.ACS,
                "U.S. Census Bureau",
                "Summary",
                URI.create("https://www.census.gov/" + id),
                ResearchObjectOrigin.REPOSITORY,
                SourceSystem.CENSUS);
        return DiscoveryDocument.of(result);
    }

    private static FederatedResearchRecord record(String id, String program) {
        return new FederatedResearchRecord(
                FederatedSourceSystem.DOE_OSTI,
                id,
                "Federated " + id,
                "Summary",
                "U.S. Department of Energy",
                program,
                ResearchObjectType.PUBLICATION,
                URI.create("https://www.osti.gov/biblio/" + id),
                null,
                OffsetDateTime.parse("2026-08-29T12:00:00Z"),
                "test-adapter",
                List.of(),
                List.of(),
                Map.of());
    }

    private static final class RecordingCatalog implements FederatedMetadataCatalog {
        private final List<FederatedResearchRecord> records;
        private final List<Integer> requestedLimits = new ArrayList<>();

        private RecordingCatalog(List<FederatedResearchRecord> records) {
            this.records = records.stream()
                    .sorted(Comparator.comparing(FederatedResearchRecord::id))
                    .toList();
        }

        @Override
        public void upsertBatch(List<FederatedResearchRecord> records) {}

        @Override
        public Optional<FederatedResearchRecord> findById(String id) {
            return records.stream().filter((record) -> record.id().equals(id)).findFirst();
        }

        @Override
        public List<FederatedResearchRecord> findAfterId(String afterId, int limit) {
            requestedLimits.add(limit);
            return records.stream()
                    .filter((record) -> afterId == null || record.id().compareTo(afterId) > 0)
                    .limit(limit)
                    .toList();
        }

        @Override
        public long count() {
            return records.size();
        }
    }
}
