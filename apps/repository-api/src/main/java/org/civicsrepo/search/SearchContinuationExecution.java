package org.civicsrepo.search;

import org.civicsrepo.generated.dto.SearchResponse;

/** Results plus the backend-native position needed to continue deterministic traversal. */
public record SearchContinuationExecution(
        SearchResponse response,
        Long engineReportedMs,
        String nextPosition) {
    public SearchContinuationExecution {
        if (response == null) {
            throw new IllegalArgumentException("response is required");
        }
        if (engineReportedMs != null && engineReportedMs < 0) {
            throw new IllegalArgumentException("engineReportedMs must be non-negative");
        }
        nextPosition = nextPosition == null || nextPosition.isBlank() ? null : nextPosition;
    }

    public boolean hasMore() {
        return nextPosition != null;
    }
}
