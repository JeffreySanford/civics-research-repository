package org.civicsrepo.search;

/**
 * Explicit OpenSearch query-shape treatment used by controlled search-comparison research.
 *
 * <p>The baseline remains the production/demo behavior. The C2.1 treatment is opt-in so historical
 * C2 evidence and ordinary Search Lab requests cannot silently inherit a research optimization.
 */
public enum OpenSearchComparisonTreatment {
    BASELINE_SCOPED_FILTERS,
    C2_1_OPTIMIZED_EQUIVALENT
}
