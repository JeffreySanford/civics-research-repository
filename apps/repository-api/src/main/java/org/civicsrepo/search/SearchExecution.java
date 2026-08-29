package org.civicsrepo.search;

import org.civicsrepo.generated.dto.SearchResponse;

/** Results and engine-reported timing captured from one search-engine response. */
public record SearchExecution(SearchResponse response, Long engineReportedMs) {
    public SearchExecution {
        if (response == null) {
            throw new IllegalArgumentException("response is required");
        }
        if (engineReportedMs != null && engineReportedMs < 0) {
            throw new IllegalArgumentException("engineReportedMs must be non-negative");
        }
    }
}
