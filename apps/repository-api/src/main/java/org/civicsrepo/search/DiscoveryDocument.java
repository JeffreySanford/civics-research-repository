package org.civicsrepo.search;

import java.util.List;
import org.civicsrepo.generated.dto.ResearchProgram;
import org.civicsrepo.generated.dto.SearchResult;

/**
 * A research object as the discovery index sees it: the result a client gets back, plus normalized
 * discovery taxonomy and text worth matching against but not worth returning.
 *
 * <p>{@code programName} is deliberately independent of the legacy {@link ResearchProgram} enum on
 * {@link SearchResult}. The curated Census catalog can keep its stable enum classification while
 * federated sources retain data-driven program names such as "Office of Science" instead of being
 * collapsed into {@code OTHER}. This is the compatibility seam used while the public contract moves
 * from fixed program values to data-driven facets.
 *
 * <p>Subjects, authors, citation and DOI are all reasons a researcher types something into a search
 * box, and none of them belong on {@code SearchResult}: a result card shows a title and a summary,
 * and widening the contract so a search engine can match on fields no caller renders would make
 * every client pay for the index's needs.
 */
public record DiscoveryDocument(
        SearchResult result,
        String programName,
        List<String> subjects,
        List<String> authors,
        String citation,
        String doi) {

    public DiscoveryDocument {
        if (result == null) {
            throw new IllegalArgumentException("result must not be null");
        }
        programName = normalizeProgramName(programName, result);
        subjects = subjects == null ? List.of() : List.copyOf(subjects);
        authors = authors == null ? List.of() : List.copyOf(authors);
    }

    /**
     * Compatibility constructor for repository/fixture callers that still use the legacy program
     * enum. New federated mappers should pass their source program name explicitly.
     */
    public DiscoveryDocument(
            SearchResult result, List<String> subjects, List<String> authors, String citation, String doi) {
        this(result, null, subjects, authors, citation, doi);
    }

    /** A document with nothing extra to match on, which is every object seeded before this existed. */
    public static DiscoveryDocument of(SearchResult result) {
        return new DiscoveryDocument(result, null, List.of(), List.of(), null, null);
    }

    private static String normalizeProgramName(String programName, SearchResult result) {
        if (programName != null && !programName.isBlank()) {
            return programName.trim();
        }
        if (result.getProgramName() != null && !result.getProgramName().isBlank()) {
            return result.getProgramName().trim();
        }
        if (result.getProgram() != null) {
            return result.getProgram().getValue();
        }
        return ResearchProgram.OTHER.getValue();
    }
}
