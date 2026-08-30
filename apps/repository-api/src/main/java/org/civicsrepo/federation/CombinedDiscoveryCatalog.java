package org.civicsrepo.federation;

import java.util.ArrayList;
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
 * Federated records are never loaded as one corpus-sized list; callers advance through stable-ID
 * pages. This becomes the input seam for the later streaming Solr/OpenSearch projection.
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
        List<DiscoveryDocument> repository = List.copyOf(repositoryDocuments.get());
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
}
