package org.civicsrepo.sources;

import java.time.LocalDate;
import java.util.List;
import org.civicsrepo.generated.dto.AccessLevel;
import org.civicsrepo.generated.dto.ResearchObjectType;
import org.civicsrepo.generated.dto.ResearchProgram;

/**
 * Normalized metadata for one research object, as a harvest adapter produces it.
 *
 * <p>This was {@code PublicDatasetMetadata} and carried only what a dataset needs. The catalog and
 * SAF path had already outgrown that: it models publications, methodology reports and projects, with
 * typed relationships, access levels, licences and researcher identity. Live sync could not express
 * any of it, so a harvested object was structurally poorer than a seeded one and the two paths
 * described different repositories.
 *
 * <p>The extra fields are optional. A harvest adapter that has nothing to say about access or
 * licensing supplies nothing, and the reconciliation skips fields with no source value rather than
 * clearing what the seed wrote — so widening this record cannot erase metadata a seeded item
 * already holds.
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
        List<ResearchObjectRelation> relations) {

    public ResearchObjectMetadata {
        authors = authors == null ? List.of() : List.copyOf(authors);
        relations = relations == null ? List.of() : List.copyOf(relations);
    }

    /**
     * The dataset shape every existing adapter produces.
     *
     * <p>Kept so adding the research-object vocabulary did not require rewriting five adapters that
     * genuinely have nothing to say about DOIs or access restrictions. A public dataset is exactly
     * what they harvest, and stating that once here is better than repeating it in each of them.
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
                List.of());
    }

    /** One author, with an ORCID only where the researcher has a public one. */
    public record ResearchAuthorMetadata(String name, String orcid) {}

    /** One typed edge: everything a harvester can assert, with the target resolved on read. */
    public record ResearchObjectRelation(String verb, String targetId, String note) {}
}
