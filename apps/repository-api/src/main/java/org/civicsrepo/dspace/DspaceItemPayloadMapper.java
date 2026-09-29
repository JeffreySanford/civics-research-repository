package org.civicsrepo.dspace;

import java.time.format.DateTimeFormatter;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.civicsrepo.sources.ResearchObjectFile;
import org.civicsrepo.sources.ResearchObjectMetadata;
import org.springframework.stereotype.Component;

@Component
public class DspaceItemPayloadMapper {
    private static final String LANGUAGE = "en_US";

    public DspaceItemPayload toItemPayload(ResearchObjectMetadata metadata) {
        List<DspaceBitstreamPayload> bitstreams =
                metadata.files().stream().map(this::toBitstreamPayload).toList();

        Map<String, List<DspaceMetadataValue>> fields = new LinkedHashMap<>(Map.ofEntries(
                entry("dc.title", metadata.title()),
                entry("dc.contributor.author", metadata.publisher()),
                entry("dc.publisher", metadata.publisher()),
                entry("dc.description.abstract", metadata.summary()),
                entry("dc.identifier.uri", metadata.sourceUrl()),
                entry("dc.relation.uri", metadata.documentationUrl()),
                entry("dc.identifier.citation", metadata.citation()),
                entry("dc.subject", metadata.program().getValue()),
                entry("dc.coverage.spatial", metadata.geography()),
                entry("crr.identifier.source", metadata.id()),
                entry("crr.program", metadata.program().getValue()),
                entry("crr.geography.level", metadata.geographicLevel()),
                entry("crr.vintage", metadata.vintageYear().toString()),
                entry("crr.source.url", metadata.sourceUrl()),
                entry("crr.documentation.url", metadata.documentationUrl())));

        // An unknown source release date is not replaced with a guessed date. Omitting the field
        // preserves the distinction between "not observed" and an actual publisher-issued date.
        putIfPresent(
                fields,
                "dc.date.issued",
                metadata.releasedOn() == null
                        ? null
                        : metadata.releasedOn().format(DateTimeFormatter.ISO_LOCAL_DATE));

        // Research-object fields, written only when the adapter has something to say. An absent
        // value is skipped rather than written empty, because the reconciliation treats a missing
        // source value as "no opinion" and leaves whatever the seed wrote intact.
        putIfPresent(fields, DspaceManagedFields.RESOURCE_TYPE_FIELD, value(metadata.contentType()));
        putIfPresent(fields, DspaceManagedFields.ACCESS_FIELD, value(metadata.accessLevel()));
        putIfPresent(fields, DspaceManagedFields.ACCESS_NOTE_FIELD, metadata.accessNote());
        putIfPresent(fields, DspaceManagedFields.LICENSE_FIELD, metadata.license());
        putIfPresent(fields, DspaceManagedFields.DOI_FIELD, metadata.doi());

        var accessGuidance = metadata.accessGuidance();
        if (accessGuidance != null) {
            putIfPresent(fields, DspaceManagedFields.ACCESS_MECHANISM_FIELD, accessGuidance.mechanism());
            putIfPresent(fields, DspaceManagedFields.ACCESS_URL_FIELD, accessGuidance.accessUrl());
            putIfPresent(
                    fields,
                    DspaceManagedFields.ACCESS_INSTRUCTIONS_FIELD,
                    accessGuidance.instructions());
            putIfPresent(
                    fields,
                    DspaceManagedFields.ACCESS_RESTRICTION_BASIS_FIELD,
                    accessGuidance.restrictionBasis());
        }

        ResearchObjectMetadata.ResearchArtifactProvenance provenance = metadata.versionProvenance();
        if (provenance != null) {
            putIfPresent(fields, DspaceManagedFields.VERSION_LABEL_FIELD, provenance.versionLabel());
            putIfPresent(
                    fields,
                    DspaceManagedFields.VERSION_DATE_FIELD,
                    provenance.versionDate() == null
                            ? null
                            : provenance.versionDate().format(DateTimeFormatter.ISO_LOCAL_DATE));
            putIfPresent(fields, DspaceManagedFields.SOURCE_SHA256_FIELD, provenance.sourceSha256());
            putIfPresent(
                    fields,
                    DspaceManagedFields.CAPTURED_AT_FIELD,
                    provenance.capturedAt() == null
                            ? null
                            : provenance.capturedAt().format(DateTimeFormatter.ISO_OFFSET_DATE_TIME));
            putIfPresent(fields, DspaceManagedFields.IS_VERSION_OF_FIELD, provenance.isVersionOf());
            putIfPresent(fields, DspaceManagedFields.SUPERSEDES_FIELD, provenance.supersedes());
            putIfPresent(fields, DspaceManagedFields.CHANGE_NOTE_FIELD, provenance.changeNote());
        }

        if (!metadata.authors().isEmpty()) {
            // dc as well as crr: dc.contributor.author is what every harvester and citation
            // exporter reads, and an author recorded only in a project schema is not deposited.
            fields.put(
                    "dc.contributor.author",
                    metadata.authors().stream()
                            .map((author) -> new DspaceMetadataValue(author.name(), LANGUAGE, null, -1))
                            .toList());
            fields.put(
                    DspaceManagedFields.RESEARCHER_FIELD,
                    metadata.authors().stream()
                            .map((author) -> new DspaceMetadataValue(
                                    ResearchObjectJson.author(author.name(), author.orcid()), LANGUAGE, null, -1))
                            .toList());
        }

        if (!metadata.relations().isEmpty()) {
            fields.put(
                    DspaceManagedFields.RELATION_FIELD,
                    metadata.relations().stream()
                            .map((relation) -> new DspaceMetadataValue(
                                    ResearchObjectJson.relation(relation.verb(), relation.targetId(), relation.note()),
                                    LANGUAGE,
                                    null,
                                    -1))
                            .toList());
        }

        // The manifest is metadata, not bitstreams: the file list lives here so a linked object and
        // a mirrored one are described the same way.
        if (!bitstreams.isEmpty()) {
            fields.put(DspaceFileManifest.FIELD, DspaceFileManifest.toMetadataValues(bitstreams, LANGUAGE));
        }

        return new DspaceItemPayload(metadata.title(), "item", Map.copyOf(fields), bitstreams);
    }

    private void putIfPresent(
            Map<String, List<DspaceMetadataValue>> fields, String field, String value) {
        if (value != null && !value.isBlank()) {
            fields.put(field, List.of(new DspaceMetadataValue(value, LANGUAGE, null, -1)));
        }
    }

    /** getValue(), never name(): the generated constant and the contract value differ for some enums. */
    private String value(org.civicsrepo.generated.dto.ResearchObjectType contentType) {
        return contentType == null ? null : contentType.getValue();
    }

    private String value(org.civicsrepo.generated.dto.AccessLevel accessLevel) {
        return accessLevel == null ? null : accessLevel.getValue();
    }

    private Map.Entry<String, List<DspaceMetadataValue>> entry(String field, String value) {
        return Map.entry(field, List.of(new DspaceMetadataValue(value, LANGUAGE, null, -1)));
    }

    private DspaceBitstreamPayload toBitstreamPayload(ResearchObjectFile file) {
        return new DspaceBitstreamPayload(
                file.id(), file.label(), "ORIGINAL", file.format(), file.url(), file.sizeBytes());
    }
}
