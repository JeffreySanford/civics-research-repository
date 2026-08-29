package org.civicsrepo.federation;

import java.net.URI;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import org.civicsrepo.generated.dto.ResearchObjectType;

/**
 * Normalized metadata for a research object discovered from an external catalog.
 *
 * <p>The publisher remains authoritative for the referenced research object. This record stores
 * only metadata, provenance and links required to reproduce discovery; it does not imply that the
 * referenced PDF, dataset, granule or other binary is preserved locally.
 */
public record FederatedResearchRecord(
        FederatedSourceSystem sourceSystem,
        String sourceIdentifier,
        String title,
        String summary,
        String publisher,
        String program,
        ResearchObjectType contentType,
        URI sourceUrl,
        OffsetDateTime sourceUpdatedAt,
        OffsetDateTime harvestedAt,
        String adapterVersion,
        List<String> authors,
        List<String> subjects,
        Map<String, Object> sourceMetadata) {

    public FederatedResearchRecord {
        Objects.requireNonNull(sourceSystem, "sourceSystem");
        sourceIdentifier = requireText(sourceIdentifier, "sourceIdentifier");
        title = requireText(title, "title");
        publisher = requireText(publisher, "publisher");
        Objects.requireNonNull(contentType, "contentType");
        Objects.requireNonNull(sourceUrl, "sourceUrl");
        Objects.requireNonNull(harvestedAt, "harvestedAt");
        adapterVersion = requireText(adapterVersion, "adapterVersion");
        summary = summary == null ? "" : summary;
        program = program == null ? "" : program;
        authors = authors == null ? List.of() : List.copyOf(authors);
        subjects = subjects == null ? List.of() : List.copyOf(subjects);
        sourceMetadata = sourceMetadata == null ? Map.of() : Map.copyOf(sourceMetadata);
    }

    /** Stable local identity that never relies on title text or source ordering. */
    public String id() {
        return sourceSystem.name() + ":" + sourceIdentifier;
    }

    private static String requireText(String value, String field) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException(field + " must not be blank");
        }
        return value;
    }
}
