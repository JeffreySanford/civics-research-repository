package org.civicsrepo.federation;

import java.util.List;

/** One bounded source page plus its accepted records, quarantinable rejects and resume cursor. */
public record HarvestPage(
        List<FederatedResearchRecord> records,
        List<HarvestRejection> rejections,
        String nextCursor,
        boolean complete) {

    /** Compatibility constructor for adapters/tests with no record-level rejections. */
    public HarvestPage(List<FederatedResearchRecord> records, String nextCursor, boolean complete) {
        this(records, List.of(), nextCursor, complete);
    }

    public HarvestPage {
        records = records == null ? List.of() : List.copyOf(records);
        rejections = rejections == null ? List.of() : List.copyOf(rejections);
        if (!complete && (nextCursor == null || nextCursor.isBlank())) {
            throw new IllegalArgumentException("Incomplete harvest pages must provide nextCursor");
        }
    }
}
