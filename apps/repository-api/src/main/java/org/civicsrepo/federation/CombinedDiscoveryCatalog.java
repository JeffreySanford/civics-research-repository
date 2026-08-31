package org.civicsrepo.federation;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Objects;
import java.util.function.Supplier;
import org.civicsrepo.repository.RepositoryCatalog;
import org.civicsrepo.search.DiscoveryDocument;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

/**
 * Bounded traversal across the two discovery authorities: curated DSpace records first, then
 * federated metadata ordered by stable namespaced identifier.
 *
 * <p>The repository slice is intentionally small and already bounded by {@link RepositoryCatalog}.
 * It is sorted by stable result ID before paging because repository reads do not promise an order.
 * Federated records are never loaded as one corpus-sized list; callers advance through stable-ID
 * pages. Page size therefore cannot change the canonical authority/order sequence.
 *
 * <p>The cursor is an internal domain value. Browser/API pagination should encode its eventual
 * public form as an opaque token rather than exposing offsets or database identifiers directly.
 */
@Component
public class CombinedDiscoveryCatalog {
    private static final int MAX_PAGE_SIZE = 10_000;

    private final Supplier<List<DiscoveryDocument>> repositoryDocuments;
    private final FederatedMetadataCatalog federatedCatalog;
    private final FederatedDiscoveryDocumentMapper federatedMapper;

    @Autowired
    public CombinedDiscoveryCatalog(
            RepositoryCatalog repositoryCatalog,
            FederatedMetadataCatalog federatedCatalog,
            FederatedDiscoveryDocumentMapper federatedMapper) {
        this(repositoryCatalog::findAllDiscoveryDocuments, federatedCatalog, federatedMapper);
    }

    CombinedDiscoveryCatalog(
            Supplier<List<DiscoveryDocument>> repositoryDocuments,
            FederatedMetadataCatalog federatedCatalog,
            FederatedDiscoveryDocumentMapper federatedMapper) {
        this.repositoryDocuments = Objects.requireNonNull(repositoryDocuments, "repositoryDocuments");
        this.federatedCatalog = Objects.requireNonNull(federatedCatalog, "federatedCatalog");
        this.federatedMapper = Objects.requireNonNull(federatedMapper, "federatedMapper");
    }

    public DiscoveryPage findAfter(DiscoveryCursor cursor, int limit) {
        int safeLimit = Math.max(1, Math.min(limit, MAX_PAGE_SIZE));
        DiscoveryCursor current = cursor == null ? DiscoveryCursor.start() : cursor;
        List<DiscoveryDocument> repository = repositoryDocuments.get().stream()
                .sorted(Comparator.comparing((document) -> document.result().getId()))
                .toList();
        int repositoryOffset = Math.max(0, Math.min(current.repositoryOffset(), repository.size()));
        List<DiscoveryDocument> documents = new ArrayList<>(safeLimit);

        int nextRepositoryOffset = repositoryOffset;
        while (nextRepositoryOffset < repository.size() && documents.size() < safeLimit) {
            documents.add(repository.get(nextRepositoryOffset));
            nextRepositoryOffset++;
        }

        String federatedAfterId = current.federatedAfterId();
        boolean federatedComplete = false;
        if (nextRepositoryOffset >= repository.size() && documents.size() < safeLimit) {
            int requestedFederated = safeLimit - documents.size();
            List<FederatedResearchRecord> federated =
                    federatedCatalog.findAfterId(federatedAfterId, requestedFederated);
            for (FederatedResearchRecord record : federated) {
                documents.add(federatedMapper.toDiscoveryDocument(record));
            }
            if (!federated.isEmpty()) {
                federatedAfterId = federated.getLast().id();
            }
            federatedComplete = federated.size() < requestedFederated;
        }

        boolean repositoryComplete = nextRepositoryOffset >= repository.size();
        boolean complete = repositoryComplete && federatedComplete;
        DiscoveryCursor nextCursor = complete
                ? null
                : new DiscoveryCursor(nextRepositoryOffset, federatedAfterId);

        return new DiscoveryPage(List.copyOf(documents), nextCursor, complete);
    }

    /**
     * Returns one deterministic page from exactly one federated source's stable-ID range.
     *
     * <p>This is the projection counterpart to bounded source snapshots. A composite corpus can
     * therefore stream the exact quota for each source without materializing a corpus-sized ID list
     * or accidentally taking the first N rows across all retained sources.
     */
    public FederatedDiscoveryPage findFederatedAfter(
            FederatedSourceSystem sourceSystem, String afterId, int limit) {
        Objects.requireNonNull(sourceSystem, "sourceSystem");
        int safeLimit = Math.max(1, Math.min(limit, MAX_PAGE_SIZE));
        String sourcePrefix = sourceSystem.name() + ":";
        String cursor = afterId == null || afterId.isBlank() ? sourcePrefix : afterId;
        if (!cursor.startsWith(sourcePrefix)) {
            throw new IllegalArgumentException(
                    "Federated cursor does not belong to source " + sourceSystem.name());
        }

        List<FederatedResearchRecord> page = federatedCatalog.findAfterId(cursor, safeLimit);
        List<DiscoveryDocument> documents = new ArrayList<>(Math.min(page.size(), safeLimit));
        String nextAfterId = null;
        boolean sourceRangeComplete = page.size() < safeLimit;
        for (FederatedResearchRecord record : page) {
            if (record.sourceSystem() != sourceSystem || !record.id().startsWith(sourcePrefix)) {
                sourceRangeComplete = true;
                break;
            }
            documents.add(federatedMapper.toDiscoveryDocument(record));
            nextAfterId = record.id();
        }

        if (documents.size() < page.size()) {
            sourceRangeComplete = true;
        }
        return new FederatedDiscoveryPage(List.copyOf(documents), nextAfterId, sourceRangeComplete);
    }

    public long retainedFederatedCount() {
        return federatedCatalog.count();
    }

    public record DiscoveryCursor(int repositoryOffset, String federatedAfterId) {
        public DiscoveryCursor {
            if (repositoryOffset < 0) {
                throw new IllegalArgumentException("repositoryOffset must not be negative");
            }
        }

        public static DiscoveryCursor start() {
            return new DiscoveryCursor(0, null);
        }
    }

    public record DiscoveryPage(
            List<DiscoveryDocument> documents,
            DiscoveryCursor nextCursor,
            boolean complete) {
        public DiscoveryPage {
            documents = documents == null ? List.of() : List.copyOf(documents);
            if (complete && nextCursor != null) {
                throw new IllegalArgumentException("complete discovery page must not expose a next cursor");
            }
            if (!complete && nextCursor == null) {
                throw new IllegalArgumentException("incomplete discovery page requires a next cursor");
            }
        }
    }

    public record FederatedDiscoveryPage(
            List<DiscoveryDocument> documents,
            String nextAfterId,
            boolean sourceRangeComplete) {
        public FederatedDiscoveryPage {
            documents = documents == null ? List.of() : List.copyOf(documents);
            if (!documents.isEmpty() && (nextAfterId == null || nextAfterId.isBlank())) {
                throw new IllegalArgumentException("non-empty federated discovery page requires a next cursor");
            }
        }
    }
}
