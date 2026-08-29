package org.civicsrepo.federation;

import java.util.List;

/** One bounded source page plus the cursor required to continue it. */
public record HarvestPage(List<FederatedResearchRecord> records, String nextCursor, boolean complete) {
    public HarvestPage {
        records = records == null ? List.of() : List.copyOf(records);
        if (!complete && (nextCursor == null || nextCursor.isBlank())) {
            throw new IllegalArgumentException("Incomplete harvest pages must provide nextCursor");
        }
    }
}
