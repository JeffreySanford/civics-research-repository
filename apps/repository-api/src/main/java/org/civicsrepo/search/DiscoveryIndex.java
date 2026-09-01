package org.civicsrepo.search;

import java.util.List;
import java.util.Map;
import org.civicsrepo.generated.dto.ResearchObjectType;
import org.civicsrepo.generated.dto.ResearchProgram;
import org.civicsrepo.generated.dto.SearchResponse;
import org.civicsrepo.generated.dto.SourceSystem;

/**
 * The public search engine used by the browser-facing discovery path.
 *
 * <p>The projection lifecycle lives in {@link DiscoveryProjectionTarget}. This interface adds the
 * query behavior needed by the application. Keeping those concerns separate lets the same
 * normalized document set be projected into OpenSearch for comparison without making OpenSearch the
 * live discovery engine before the comparison has earned that decision.
 *
 * <p>DSpace runs its own Solr for its own purposes and always will; this index is a separate,
 * application-owned projection serving the public search path.
 */
public interface DiscoveryIndex extends DiscoveryProjectionTarget {

    /**
     * Legacy curated per-program counts used by the repository/admin overview. Public discovery
     * filtering uses data-driven program names instead.
     */
    Map<ResearchProgram, Integer> programFacetCounts();

    SearchResponse search(
            String query,
            List<String> programs,
            String geography,
            ResearchObjectType contentType,
            Integer vintageYear,
            int page,
            int pageSize);

    /**
     * Additive mixed-authority filter surface for normal discovery. Alternate implementations that
     * have not adopted publisher/source filtering yet retain their legacy behavior, while the live
     * Solr discovery implementation overrides this method.
     */
    default SearchResponse search(
            String query,
            List<String> programs,
            String publisher,
            SourceSystem sourceSystem,
            String geography,
            ResearchObjectType contentType,
            Integer vintageYear,
            int page,
            int pageSize) {
        return search(query, programs, geography, contentType, vintageYear, page, pageSize);
    }

    /**
     * Runs the same search while retaining engine-native timing when an implementation exposes it.
     * The default preserves compatibility for alternate discovery-index implementations.
     */
    default SearchExecution searchWithDiagnostics(
            String query,
            List<String> programs,
            String geography,
            ResearchObjectType contentType,
            Integer vintageYear,
            int page,
            int pageSize) {
        return new SearchExecution(search(query, programs, geography, contentType, vintageYear, page, pageSize), null);
    }

    /**
     * Runs the normalized comparison-only filter surface. Implementations participating in the
     * dual-engine lab must override this method when exact identifiers or mixed-authority filters
     * are supplied; silently dropping those filters would produce invalid parity evidence.
     */
    default SearchExecution searchWithDiagnostics(SearchComparisonCriteria criteria) {
        if (criteria.hasComparisonOnlyFilters()) {
            throw new UnsupportedOperationException(
                    "This discovery index does not implement comparison-only structured filters.");
        }
        return searchWithDiagnostics(
                criteria.query(),
                criteria.programs(),
                criteria.geography(),
                criteria.contentType(),
                criteria.vintageYear(),
                criteria.page(),
                criteria.pageSize());
    }
}
