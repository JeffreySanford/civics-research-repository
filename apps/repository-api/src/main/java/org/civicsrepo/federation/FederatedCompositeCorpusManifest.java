package org.civicsrepo.federation;

import java.time.OffsetDateTime;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;

/** Immutable identity and provenance for one evidence-grade multi-source federated corpus. */
public record FederatedCompositeCorpusManifest(
        String compositionVersion,
        String mode,
        CorpusProfile corpusProfile,
        List<FederatedCompositeCorpusSource> sources,
        long federatedRecordCount,
        String compositionSha256,
        OffsetDateTime capturedAt) {

    public static final String MODE = "COMPOSITE_SNAPSHOT";

    public FederatedCompositeCorpusManifest {
        compositionVersion = requireText(compositionVersion, "compositionVersion");
        mode = requireText(mode, "mode");
        if (!MODE.equals(mode)) {
            throw new IllegalArgumentException("mode must be " + MODE);
        }
        Objects.requireNonNull(corpusProfile, "corpusProfile");
        if (sources == null || sources.size() < 2) {
            throw new IllegalArgumentException("A composite corpus requires at least two sources");
        }
        sources = sources.stream()
                .sorted(Comparator.comparing(source -> source.sourceSystem().name()))
                .toList();
        Set<FederatedSourceSystem> distinctSources = new HashSet<>();
        long countedRecords = 0;
        for (FederatedCompositeCorpusSource source : sources) {
            if (!distinctSources.add(source.sourceSystem())) {
                throw new IllegalArgumentException("Composite corpus sources must be unique");
            }
            countedRecords = Math.addExact(countedRecords, source.retainedRecordCount());
        }
        if (federatedRecordCount != countedRecords) {
            throw new IllegalArgumentException("federatedRecordCount must equal the sum of retained source records");
        }
        compositionSha256 = requireSha256(compositionSha256, "compositionSha256");
        Objects.requireNonNull(capturedAt, "capturedAt");
    }

    private static String requireText(String value, String field) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException(field + " must not be blank");
        }
        return value.trim();
    }

    private static String requireSha256(String value, String field) {
        String normalized = requireText(value, field);
        if (!normalized.matches("[0-9a-f]{64}")) {
            throw new IllegalArgumentException(field + " must be a lowercase SHA-256 hex digest");
        }
        return normalized;
    }
}
