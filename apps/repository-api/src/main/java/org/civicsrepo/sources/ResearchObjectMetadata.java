package org.civicsrepo.sources;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import org.civicsrepo.generated.dto.AccessLevel;
import org.civicsrepo.generated.dto.ResearchObjectType;
import org.civicsrepo.generated.dto.ResearchProgram;
import org.civicsrepo.metadata.ResearchAccessMetadata;

/**
 * Normalized metadata for one research object, as a harvest adapter produces it.
 *
 * <p>This was {@code PublicDatasetMetadata} and carried only what a dataset needs. The catalog and
 * SAF path had already outgrown that: it models publications, methodology reports and projects, with
 * typed relationships, access levels, licences and researcher identity. Live sync could not express
 * any of it, so a harvested object was structurally poorer than a seeded one and the two paths
 * described different repositories.
 *
 * <p>The extra fields are optional. A harvest adapter that has nothing to say about access,
 * licensing, or version provenance supplies nothing, and reconciliation skips fields with no source
 * value rather than clearing what the seed wrote. A missing source fact is therefore "no opinion",
 * never an instruction to manufacture or erase repository evidence.
 */
public record ResearchObjectMetadata(
        String id,
        String title,
        ResearchProgram program,
        String publisher,
        String summary,
        String geography,
        String geographicLevel,
        Integer vintageYear,
        LocalDate releasedOn,
        String sourceUrl,
        String documentationUrl,
        String citation,
        List<ResearchObjectFile> files,
        ResearchObjectType contentType,
        AccessLevel accessLevel,
        String accessNote,
        String license,
        String doi,
        List<ResearchAuthorMetadata> authors,
        List<ResearchObjectRelation> relations,
        ResearchArtifactProvenance versionProvenance,
        ResearchAccessMetadata accessGuidance) {

    public ResearchObjectMetadata {
        authors = authors == null ? List.of() : List.copyOf(authors);
        relations = relations == null ? List.of() : List.copyOf(relations);
    }

    /** Compatibility constructor for callers that already supply artifact provenance. */
    public ResearchObjectMetadata(
            String id,
            String title,
            ResearchProgram program,
            String publisher,
            String summary,
            String geography,
            String geographicLevel,
            Integer vintageYear,
            LocalDate releasedOn,
            String sourceUrl,
            String documentationUrl,
            String citation,
            List<ResearchObjectFile> files,
            ResearchObjectType contentType,
            AccessLevel accessLevel,
            String accessNote,
            String license,
            String doi,
            List<ResearchAuthorMetadata> authors,
            List<ResearchObjectRelation> relations,
            ResearchArtifactProvenance versionProvenance) {
        this(
                id,
                title,
                program,
                publisher,
                summary,
                geography,
                geographicLevel,
                vintageYear,
                releasedOn,
                sourceUrl,
                documentationUrl,
                citation,
                files,
                contentType,
                accessLevel,
                accessNote,
                license,
                doi,
                authors,
                relations,
                versionProvenance,
                null);
    }

    /** Compatibility constructor for adapters/tests that do not expose artifact provenance. */
    public ResearchObjectMetadata(
            String id,
            String title,
            ResearchProgram program,
            String publisher,
            String summary,
            String geography,
            String geographicLevel,
            Integer vintageYear,
            LocalDate releasedOn,
            String sourceUrl,
            String documentationUrl,
            String citation,
            List<ResearchObjectFile> files,
            ResearchObjectType contentType,
            AccessLevel accessLevel,
            String accessNote,
            String license,
            String doi,
            List<ResearchAuthorMetadata> authors,
            List<ResearchObjectRelation> relations) {
        this(
                id,
                title,
                program,
                publisher,
                summary,
                geography,
                geographicLevel,
                vintageYear,
                releasedOn,
                sourceUrl,
                documentationUrl,
                citation,
                files,
                contentType,
                accessLevel,
                accessNote,
                license,
                doi,
                authors,
                relations,
                null,
                null);
    }

    /**
     * The dataset shape every existing adapter produces.
     *
     * <p>Kept so adding the research-object vocabulary did not require rewriting adapters that
     * genuinely have nothing to say about DOIs, access restrictions, or version provenance.
     */
    public static ResearchObjectMetadata dataset(
            String id,
            String title,
            ResearchProgram program,
            String publisher,
            String summary,
            String geography,
            String geographicLevel,
            Integer vintageYear,
            LocalDate releasedOn,
            String sourceUrl,
            String documentationUrl,
            String citation,
            List<ResearchObjectFile> files) {
        return dataset(
                id,
                title,
                program,
                publisher,
                summary,
                geography,
                geographicLevel,
                vintageYear,
                releasedOn,
                sourceUrl,
                documentationUrl,
                citation,
                files,
                null);
    }

    /** Public dataset convenience shape with explicitly observed artifact provenance. */
    public static ResearchObjectMetadata dataset(
            String id,
            String title,
            ResearchProgram program,
            String publisher,
            String summary,
            String geography,
            String geographicLevel,
            Integer vintageYear,
            LocalDate releasedOn,
            String sourceUrl,
            String documentationUrl,
            String citation,
            List<ResearchObjectFile> files,
            ResearchArtifactProvenance versionProvenance) {
        return new ResearchObjectMetadata(
                id,
                title,
                program,
                publisher,
                summary,
                geography,
                geographicLevel,
                vintageYear,
                releasedOn,
                sourceUrl,
                documentationUrl,
                citation,
                files,
                ResearchObjectType.DATASET,
                AccessLevel.PUBLIC,
                null,
                null,
                null,
                List.of(),
                List.of(),
                versionProvenance,
                null);
    }

    /** One author, with an ORCID only where the researcher has a public one. */
    public record ResearchAuthorMetadata(String name, String orcid) {}

    /** One typed edge: everything a harvester can assert, with the target resolved on read. */
    public record ResearchObjectRelation(String verb, String targetId, String note) {}

    /**
     * Version-specific provenance observed from an authoritative source or retained repository
     * capture. Every field is optional independently; absent values remain unknown.
     *
     * <p>{@code sourceSha256} is fixity evidence, not a value inferred from a URL or file size.
     * {@code capturedAt} is when a retained observation was actually captured, not the current sync
     * clock. Lineage fields are asserted only when the source/repository establishes them.
     */
    public record ResearchArtifactProvenance(
            String versionLabel,
            LocalDate versionDate,
            String sourceSha256,
            OffsetDateTime capturedAt,
            String isVersionOf,
            String supersedes,
            String changeNote) {}
}
