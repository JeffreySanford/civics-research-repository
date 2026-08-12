package org.civicsrepo.search;

import java.util.List;
import org.civicsrepo.repository.RepositorySource;

/**
 * @param resultSource whether these results come from DSpace or from the fixture catalog. Carried
 *     to the client so generated placeholders are never presented as repository content.
 */
public record SearchResponse(
        RepositorySource resultSource,
        String query,
        int page,
        int pageSize,
        long totalResults,
        List<SearchResult> results,
        List<FacetGroup> facets) {

    public SearchResponse withResultSource(RepositorySource source) {
        return new SearchResponse(source, query, page, pageSize, totalResults, results, facets);
    }
}
