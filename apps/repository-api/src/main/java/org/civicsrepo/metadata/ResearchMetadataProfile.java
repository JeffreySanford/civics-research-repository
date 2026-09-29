package org.civicsrepo.metadata;

import java.net.URI;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import org.civicsrepo.generated.dto.AccessLevel;
import org.civicsrepo.generated.dto.FileFormat;
import org.civicsrepo.generated.dto.ResearchObjectType;
import org.civicsrepo.generated.dto.ResearchProgram;
import org.civicsrepo.generated.dto.VersionHistoryStatus;

/**
 * Immutable, application-owned metadata authority consumed by export/rendering layers.
 *
 * <p>The profile deliberately contains no generated mutable DTOs. It copies facts already resolved
 * by the repository/application authority and gives later serializers one deterministic boundary
 * that cannot be changed by mutating an API response after assembly.
 */
public record ResearchMetadataProfile(
        String id,
        ResearchObjectType type,
        String title,
        String abstractText,
        String publisher,
        ResearchProgram program,
        String citation,
        String doi,
        URI sourceUrl,
        URI documentationUrl,
        String geography,
        String geographicLevel,
        Integer vintageYear,
        LocalDate releasedOn,
        List<String> subjects,
        List<Author> authors,
        Access access,
        List<Distribution> distributions,
        List<Relation> relations,
        VersionHistory versions) {

    public ResearchMetadataProfile {
        subjects = immutable(subjects);
        authors = immutable(authors);
        distributions = immutable(distributions);
        relations = immutable(relations);
    }

    public record Author(String name, String orcid) {}

    public record Access(
            AccessLevel level,
            String note,
            String license,
            ResearchAccessMetadata guidance) {}

    public record Distribution(String id, String label, FileFormat format, URI url) {}

    public record Relation(
            String verb,
            String targetId,
            String targetTitle,
            ResearchObjectType targetType,
            AccessLevel targetAccessLevel,
            String note) {}

    public record VersionHistory(
            VersionHistoryStatus status,
            List<Version> items,
            String note) {
        public VersionHistory {
            items = immutable(items);
        }
    }

    public record Version(
            String id,
            String label,
            boolean current,
            String versionLabel,
            LocalDate versionDate,
            LocalDate releasedOn,
            String doi,
            URI sourceUrl,
            String sourceSha256,
            OffsetDateTime capturedAt,
            String isVersionOf,
            String supersedes,
            String changeNote) {}

    private static <T> List<T> immutable(List<T> values) {
        return values == null ? List.of() : List.copyOf(values);
    }
}
