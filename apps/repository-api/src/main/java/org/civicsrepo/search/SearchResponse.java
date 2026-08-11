package org.civicsrepo.search;

import java.util.List;

public record SearchResponse(
        String query, int page, int pageSize, long totalResults, List<SearchResult> results, List<FacetGroup> facets) {}
