package org.civicsrepo.metadata;

import java.util.List;
import org.civicsrepo.generated.dto.DatasetFile;
import org.civicsrepo.generated.dto.ResearchAccessGuidance;
import org.civicsrepo.generated.dto.ResearchArtifactVersion;
import org.civicsrepo.generated.dto.ResearchArtifactVersionHistory;
import org.civicsrepo.generated.dto.ResearchAuthor;
import org.civicsrepo.generated.dto.ResearchObjectDetail;
import org.civicsrepo.generated.dto.ResearchRelation;
import org.springframework.stereotype.Component;

/**
 * Pure copier from resolved application DTOs into the immutable metadata-profile domain.
 *
 * <p>This component has deliberately no repositories, clocks, HTTP clients, search engines or
 * normalization rules. Missing values stay missing; version lineage is copied only from the
 * supplied observed history.
 */
@Component
public final class ResearchMetadataProfileAssembler {

    public ResearchMetadataProfile assemble(
            ResearchObjectDetail detail, ResearchArtifactVersionHistory history) {
        return new ResearchMetadataProfile(
                detail.getId(),
                detail.getContentType(),
                detail.getTitle(),
                detail.getSummary(),
                detail.getPublisher(),
                detail.getProgram(),
                detail.getCitation(),
                detail.getDoi(),
                detail.getSourceUrl(),
                detail.getDocumentationUrl(),
                detail.getGeography(),
                detail.getGeographicLevel(),
                detail.getVintageYear(),
                detail.getReleasedOn(),
                detail.getSubjects(),
                authors(detail.getAuthors()),
                access(detail),
                distributions(detail.getFiles()),
                relations(detail.getRelations()),
                versions(history));
    }

    private List<ResearchMetadataProfile.Author> authors(List<ResearchAuthor> authors) {
        if (authors == null) {
            return List.of();
        }
        return authors.stream()
                .map(author -> new ResearchMetadataProfile.Author(author.getName(), author.getOrcid()))
                .toList();
    }

    private ResearchMetadataProfile.Access access(ResearchObjectDetail detail) {
        return new ResearchMetadataProfile.Access(
                detail.getAccessLevel(),
                detail.getAccessNote(),
                detail.getLicense(),
                guidance(detail.getAccessGuidance()));
    }

    private ResearchAccessMetadata guidance(ResearchAccessGuidance guidance) {
        if (guidance == null) {
            return null;
        }
        return new ResearchAccessMetadata(
                guidance.getMechanism(),
                guidance.getAccessUrl() == null ? null : guidance.getAccessUrl().toString(),
                guidance.getInstructions(),
                guidance.getRestrictionBasis());
    }

    private List<ResearchMetadataProfile.Distribution> distributions(List<DatasetFile> files) {
        if (files == null) {
            return List.of();
        }
        return files.stream()
                .map(file -> new ResearchMetadataProfile.Distribution(
                        file.getId(), file.getLabel(), file.getFormat(), file.getUrl()))
                .toList();
    }

    private List<ResearchMetadataProfile.Relation> relations(List<ResearchRelation> relations) {
        if (relations == null) {
            return List.of();
        }
        return relations.stream()
                .map(relation -> new ResearchMetadataProfile.Relation(
                        relation.getVerb() == null ? null : relation.getVerb().getValue(),
                        relation.getTargetId(),
                        relation.getTargetTitle(),
                        relation.getTargetType(),
                        relation.getTargetAccessLevel(),
                        relation.getNote()))
                .toList();
    }

    private ResearchMetadataProfile.VersionHistory versions(ResearchArtifactVersionHistory history) {
        if (history == null) {
            return null;
        }
        return new ResearchMetadataProfile.VersionHistory(
                history.getStatus(),
                versionItems(history.getVersions()),
                history.getNote());
    }

    private List<ResearchMetadataProfile.Version> versionItems(List<ResearchArtifactVersion> versions) {
        if (versions == null) {
            return List.of();
        }
        return versions.stream().map(this::version).toList();
    }

    private ResearchMetadataProfile.Version version(ResearchArtifactVersion version) {
        return new ResearchMetadataProfile.Version(
                version.getId(),
                version.getLabel(),
                Boolean.TRUE.equals(version.getCurrent()),
                version.getVersionLabel(),
                version.getVersionDate(),
                version.getReleasedOn(),
                version.getDoi(),
                version.getSourceUrl(),
                version.getSourceSha256(),
                version.getCapturedAt(),
                version.getIsVersionOf(),
                version.getSupersedes(),
                version.getChangeNote());
    }
}
