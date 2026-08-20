package org.civicsrepo.search;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.civicsrepo.generated.dto.ResearchObjectType;
import org.civicsrepo.generated.dto.ResearchProgram;
import org.civicsrepo.generated.dto.SearchResponse;

/**
 * The public discovery projection, as the rest of the application uses it.
 *
 * <p>Extracted because three services depended on {@code SolrSearchClient} by its concrete type,
 * which made a replaceable component look like a permanent one. The projection is deliberately
 * rebuildable — {@code pnpm run reindex} discards and rewrites it from DSpace — so the engine behind
 * it is an implementation choice, and the architecture should say so.
 *
 * <p>That matters beyond tidiness. DSpace runs its own Solr for its own purposes and always will;
 * this index is a separate, application-owned projection serving the public search path. Naming the
 * boundary is what makes "we could run this on OpenSearch" a scoped decision with one implementation
 * to write, rather than a claim about a rewrite nobody has measured.
 *
 * <p>{@link #indexName()} rather than "core": a core is Solr's word. The admin DTO still calls the
 * field {@code core} because that is a contract change with its own blast radius, and renaming a
 * wire field to tidy an interface is not a trade worth making here.
 */
public interface DiscoveryIndex {

    /** Whether a projection is configured at all; false means search answers from memory. */
    boolean isEnabled();

    /** Whether the configured projection answers a liveness probe. */
    boolean isReachable();

    String baseUrl();

    /** The named index this projection writes to. */
    String indexName();

    /** Documents currently searchable, or empty when the index cannot be read. */
    Optional<Integer> documentCount();

    /** Per-program document counts, used by the admin overview to compare against the repository. */
    Map<ResearchProgram, Integer> programFacetCounts();

    /**
     * Replaces the projection with these documents.
     *
     * <p>A replace rather than a merge: the projection has no authority of its own, so a rebuild
     * must not leave behind objects the repository no longer contains.
     */
    void indexResearchObjects(List<DiscoveryDocument> objects);

    SearchResponse search(
            String query,
            List<ResearchProgram> programs,
            String geography,
            ResearchObjectType contentType,
            Integer vintageYear,
            int page,
            int pageSize);
}
