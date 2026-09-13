package org.civicsrepo.repository;

import com.fasterxml.jackson.databind.JsonNode;
import java.net.URI;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.format.DateTimeParseException;
import java.util.Optional;
import org.civicsrepo.dspace.DspaceManagedFields;
import org.civicsrepo.dspace.DspaceRestClient.DspaceVersionRecord;
import org.civicsrepo.generated.dto.ResearchArtifactVersion;

/** Maps version/provenance facts stored in DSpace into the public version contract. */
final class RepositoryArtifactVersionMapper {
    private static final String DSPACE_VERSION_PREFIX = "dspace-version:";

    private RepositoryArtifactVersionMapper() {}

    /** Current observed source/repository provenance when no first-class DSpace history is known. */
    static ResearchArtifactVersion toVersion(JsonNode item, String identifier) {
        ResearchArtifactVersion version = new ResearchArtifactVersion(identifier, title(item, identifier))
                .current(true)
                .versionLabel(firstValue(item, DspaceManagedFields.VERSION_LABEL_FIELD).orElse(null))
                .versionDate(firstValue(item, DspaceManagedFields.VERSION_DATE_FIELD)
                        .flatMap(RepositoryArtifactVersionMapper::parseDate)
                        .orElse(null))
                .isVersionOf(firstValue(item, DspaceManagedFields.IS_VERSION_OF_FIELD).orElse(null))
                .supersedes(firstValue(item, DspaceManagedFields.SUPERSEDES_FIELD).orElse(null))
                .changeNote(firstValue(item, DspaceManagedFields.CHANGE_NOTE_FIELD).orElse(null));

        applySourceProvenance(version, item);
        return version;
    }

    /**
     * One first-class DSpace repository version.
     *
     * <p>Repository lineage is intentionally distinct from source chronology: DSpace's own version
     * number/date/summary establish repository history, while source URL, DOI, fixity and capture
     * facts are copied only from the archived item metadata that actually records them.
     */
    static ResearchArtifactVersion toRepositoryVersion(
            DspaceVersionRecord repositoryVersion,
            String researchObjectId,
            String fallbackTitle,
            String supersedesVersionId) {
        JsonNode item = repositoryVersion.item();
        ResearchArtifactVersion version = new ResearchArtifactVersion(
                        repositoryVersionId(repositoryVersion.id()), title(item, fallbackTitle))
                .current(repositoryVersion.current())
                .versionLabel("Repository version " + repositoryVersion.version())
                .versionDate(parseDate(repositoryVersion.created()).orElse(null))
                .isVersionOf(researchObjectId)
                .supersedes(supersedesVersionId == null ? null : repositoryVersionId(supersedesVersionId))
                .changeNote(repositoryVersion.summary());

        applySourceProvenance(version, item);
        return version;
    }

    private static void applySourceProvenance(ResearchArtifactVersion version, JsonNode item) {
        if (item == null || item.isMissingNode() || item.isNull()) {
            return;
        }

        version.releasedOn(firstValue(item, "dc.date.issued")
                        .flatMap(RepositoryArtifactVersionMapper::parseDate)
                        .orElse(null))
                .doi(firstValue(item, DspaceManagedFields.DOI_FIELD).orElse(null))
                .sourceSha256(firstValue(item, DspaceManagedFields.SOURCE_SHA256_FIELD).orElse(null))
                .capturedAt(firstValue(item, DspaceManagedFields.CAPTURED_AT_FIELD)
                        .flatMap(RepositoryArtifactVersionMapper::parseTimestamp)
                        .orElse(null));

        firstValue(item, DspaceManagedFields.SOURCE_URL_FIELD)
                .or(() -> firstValue(item, "dc.identifier.uri"))
                .map(URI::create)
                .ifPresent(version::setSourceUrl);
    }

    private static String repositoryVersionId(String versionId) {
        return DSPACE_VERSION_PREFIX + versionId;
    }

    private static String title(JsonNode item, String fallback) {
        if (item == null || item.isMissingNode() || item.isNull()) {
            return fallback;
        }
        return firstValue(item, "dc.title").orElseGet(() -> {
            String name = item.path("name").asText("").trim();
            return name.isEmpty() ? fallback : name;
        });
    }

    private static Optional<LocalDate> parseDate(String value) {
        if (value == null) {
            return Optional.empty();
        }
        String trimmed = value.trim();
        try {
            if (trimmed.length() == 4) {
                return Optional.of(LocalDate.of(Integer.parseInt(trimmed), 1, 1));
            }
            if (trimmed.length() == 7) {
                return Optional.of(LocalDate.parse(trimmed + "-01"));
            }
            return Optional.of(LocalDate.parse(trimmed.substring(0, Math.min(10, trimmed.length()))));
        } catch (DateTimeParseException | NumberFormatException | IndexOutOfBoundsException exception) {
            return Optional.empty();
        }
    }

    private static Optional<OffsetDateTime> parseTimestamp(String value) {
        try {
            return Optional.of(OffsetDateTime.parse(value.trim()));
        } catch (DateTimeParseException exception) {
            return Optional.empty();
        }
    }

    private static Optional<String> firstValue(JsonNode item, String field) {
        if (item == null || item.isMissingNode() || item.isNull()) {
            return Optional.empty();
        }
        for (JsonNode value : item.path("metadata").path(field)) {
            String text = value.path("value").asText("").trim();
            if (!text.isEmpty()) {
                return Optional.of(text);
            }
        }
        return Optional.empty();
    }
}
