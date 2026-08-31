package org.civicsrepo.federation;

import java.util.List;
import java.util.Objects;

/** Explicit operator request to compose already-captured bounded source snapshots. */
public record FederatedCompositeCorpusCaptureRequest(
        CorpusProfile corpusProfile, List<FederatedCompositeCorpusSourceRequest> sources) {

    public FederatedCompositeCorpusCaptureRequest {
        Objects.requireNonNull(corpusProfile, "corpusProfile");
        if (sources == null || sources.size() < 2) {
            throw new IllegalArgumentException("Composite corpus evidence requires at least two source requests");
        }
        sources = List.copyOf(sources);
    }
}
