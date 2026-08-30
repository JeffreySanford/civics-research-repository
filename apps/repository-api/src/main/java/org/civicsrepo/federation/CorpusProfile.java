package org.civicsrepo.federation;

import java.util.OptionalLong;

/** Stable corpus sizes that remain available for demo, scale and cluster comparisons. */
public enum CorpusProfile {
    CURATED_DEMO(null),
    FEDERATED_10K(10_000L),
    FEDERATED_100K(100_000L),
    FEDERATED_1M(1_000_000L),
    FULL(null);

    private final Long targetRecordCount;

    CorpusProfile(Long targetRecordCount) {
        this.targetRecordCount = targetRecordCount;
    }

    public OptionalLong targetRecordCount() {
        return targetRecordCount == null ? OptionalLong.empty() : OptionalLong.of(targetRecordCount);
    }
}
