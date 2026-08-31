package org.civicsrepo.search;

/** Controls which search engine executes first for one comparison request. */
public enum SearchComparisonExecutionOrder {
    SOLR_FIRST,
    OPENSEARCH_FIRST
}
