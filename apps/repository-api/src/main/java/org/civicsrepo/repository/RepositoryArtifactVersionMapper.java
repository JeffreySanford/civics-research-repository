package org.civicsrepo.repository;

import com.fasterxml.jackson.databind.JsonNode;
import java.net.URI;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.format.DateTimeParseException;
import java.util.Optional;
import org.civicsrepo.dspace.DspaceManagedFields;
import org.civicsrepo.generated.dto.ResearchArtifactVersion;

/** Maps version/provenance facts stored on one DSpace item into the public version contract. */
final class RepositoryArtifactVersionMapper {
    private RepositoryArtifactVersionMapper() {}

    static ResearchArtifactVersion toVersion(JsonNode item, String identifier) {
        ResearchArtifactVersion version = new ResearchArtifactVersion(identifier, title(item))
                .current(true)
                .versionLabel(firstValue(item, DspaceManagedFields.VERSION_LABEL_FIELD).orElse(null))
                .versionDate(firstValue(item, DspaceManagedFields.VERSION_DATE_FIELD)
                        .flatMap(RepositoryArtifactVersionMapper::parseDate)
                        .orElse(null))
                .releasedOn(firstValue(item, "dc.date.issued")
                        .flatMap(RepositoryArtifactVersionMapper::parseDate)
                        .orElse(null))
                .doi(firstValue(item, DspaceManagedFields.DOI_FIELD).orElse(null))
                .sourceSha256(firstValue(item, DspaceManagedFields.SOURCE_SHA256_FIELD).orElse(null))
                .capturedAt(firstValue(item, DspaceManagedFields.CAPTURED_AT_FIELD)
                        .flatMap(RepositoryArtifactVersionMapper::parseTimestamp)
                        .orElse(null))
                .isVersionOf(firstValue(item, DspaceManagedFields.IS_VERSION_OF_FIELD).orElse(null))
                .supersedes(firstValue(item, DspaceManagedFields.SUPERSEDES_FIELD).orElse(null))
                .changeNote(firstValue(item, DspaceManagedFields.CHANGE_NOTE_FIELD).orElse(null));

        firstValue(item, DspaceManagedFields.SOURCE_URL_FIELD)
                .or(() -> firstValue(item, "dc.identifier.uri"))
                .map(URI::create)
                .ifPresent(version::setSourceUrl);

        return version;
    }

    private static String title(JsonNode item) {
        return firstValue(item, "dc.title").orElseGet(() -> item.path("name").asText());
    }

    private static Optional<LocalDate> parseDate(String value) {
        String trimmed = value.trim();
        try {
            if (trimmed.length() == 4) {
                return Optional.of(LocalDate.of(Integer.parseInt(trimmed), 1, 1));
            }
            if (trimmed.length() == 7) {
                return Optional.of(LocalDate.parse(trimmed + "-01"));
            }
            return Optional.of(LocalDate.parse(trimmed.substring(0, Math.min(10, trimmed.length()))));
        } catch (DateTimeParseException | NumberFormatException exception) {
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
        for (JsonNode value : item.path("metadata").path(field)) {
            String text = value.path("value").asText("").trim();
            if (!text.isEmpty()) {
                return Optional.of(text);
            }
        }
        return Optional.empty();
    }
}
