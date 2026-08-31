package org.civicsrepo.federation;

import static org.assertj.core.api.Assertions.assertThat;

import java.net.URI;
import java.time.OffsetDateTime;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.civicsrepo.generated.dto.ResearchObjectType;
import org.junit.jupiter.api.Test;

class CombinedDiscoveryCatalogCompositeTest {
    @Test
    void streamsOnlyTheRequestedSourceStableIdRange() {
        TestCatalog federated = new TestCatalog(List.of(
                record(FederatedSourceSystem.DATA_GOV, "001"),
                record(FederatedSourceSystem.DATA_GOV, "002"),
                record(FederatedSourceSystem.DOE_OSTI, "001"),
                record(FederatedSourceSystem.DOE_OSTI, "002")));
        CombinedDiscoveryCatalog catalog = new CombinedDiscoveryCatalog(
                List::of, federated, new FederatedDiscoveryDocumentMapper());

        CombinedDiscoveryCatalog.FederatedDiscoveryPage dataGov =
                catalog.findFederatedAfter(FederatedSourceSystem.DATA_GOV, null, 10);
        CombinedDiscoveryCatalog.FederatedDiscoveryPage osti =
                catalog.findFederatedAfter(FederatedSourceSystem.DOE_OSTI, null, 1);
        CombinedDiscoveryCatalog.FederatedDiscoveryPage ostiNext = catalog.findFederatedAfter(
                FederatedSourceSystem.DOE_OSTI, osti.nextAfterId(), 1);

        assertThat(ids(dataGov)).containsExactly("DATA_GOV:001", "DATA_GOV:002");
        assertThat(dataGov.sourceRangeComplete()).isTrue();
        assertThat(ids(osti)).containsExactly("DOE_OSTI:001");
        assertThat(osti.sourceRangeComplete()).isFalse();
        assertThat(ids(ostiNext)).containsExactly("DOE_OSTI:002");
    }

    private static List<String> ids(CombinedDiscoveryCatalog.FederatedDiscoveryPage page) {
        return page.documents().stream().map(document -> document.result().getId()).toList();
    }

    private static FederatedResearchRecord record(FederatedSourceSystem sourceSystem, String id) {
        return new FederatedResearchRecord(
                sourceSystem,
                id,
                "Federated " + id,
                "Summary",
                "Publisher",
                "Program",
                ResearchObjectType.PUBLICATION,
                URI.create("https://example.gov/" + sourceSystem.name().toLowerCase() + "/" + id),
                null,
                OffsetDateTime.parse("2026-08-31T12:00:00Z"),
                "test-adapter",
                List.of(),
                List.of(),
                Map.of());
    }

    private static final class TestCatalog implements FederatedMetadataCatalog {
        private final List<FederatedResearchRecord> records;

        private TestCatalog(List<FederatedResearchRecord> records) {
            this.records = records.stream()
                    .sorted(Comparator.comparing(FederatedResearchRecord::id))
                    .toList();
        }

        @Override
        public void upsertBatch(List<FederatedResearchRecord> records) {}

        @Override
        public Optional<FederatedResearchRecord> findById(String id) {
            return records.stream().filter(record -> record.id().equals(id)).findFirst();
        }

        @Override
        public List<FederatedResearchRecord> findAfterId(String afterId, int limit) {
            return records.stream()
                    .filter(record -> afterId == null || record.id().compareTo(afterId) > 0)
                    .limit(limit)
                    .toList();
        }

        @Override
        public long count() {
            return records.size();
        }
    }
}
