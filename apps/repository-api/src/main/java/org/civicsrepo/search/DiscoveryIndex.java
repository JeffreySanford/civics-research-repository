package org.civicsrepo.search;

import java.util.List;
import java.util.Map;
import org.civicsrepo.generated.dto.ResearchObjectType;
import org.civicsrepo.generated.dto.ResearchProgram;
import org.civicsrepo.generated.dto.SearchResponse;

/**
 * The public search engine used by the browser-facing discovery path.
 *
 * <p>The projection lifecycle lives in {@link DiscoveryProjectionTarget}. This interface adds the
 * query behavior needed by the application. Keeping those concerns separate lets the same DSpace
 * document set be projected into OpenSearch for comparison without making OpenSearch the live
 * discovery engine before the comparison has earned that decision.
 *
 * <p>DSpace runs its own Solr for its own purposes and always will; this index is a separate,
 * application-owned projection serving the public search path.
 */
public interface DiscoveryIndex extends DiscoveryProjectionTarget {

    /** Per-program document counts, used by the admin overview to compare against the repository. */
    Map<ResearchProgram, Integer> programFacetCounts();

    SearchResponse search(
            String query,
            List<ResearchProgram> programs,
            String geography,
            ResearchObjectType contentType,
            Integer vintageYear,
            int page,
            int pageSize);

    /**
     * Runs the same search while retaining engine-native timing when an implementation exposes it.
     * The default preserves compatibility for alternate discovery-index implementations.
     */
    default SearchExecution searchWithDiagnostics(
            String query,
            List<ResearchProgram> programs,
            String geography,
            ResearchObjectType contentType,
            Integer vintageYear,
            int page,
            int pageSize) {
        return new SearchExecution(search(query, programs, geography, contentType, vintageYear, page, pageSize), null);
    }
}
