package org.civicsrepo.search;

import java.util.List;
import org.civicsrepo.generated.dto.SearchResult;

/**
 * A research object as the discovery index sees it: the result a client gets back, plus the text
 * worth matching against but not worth returning.
 *
 * <p>Subjects, authors, citation and DOI are all reasons a researcher types something into a search
 * box, and none of them belong on {@code SearchResult}: a result card shows a title and a summary,
 * and widening the contract so Solr can match on a field no caller renders would make every client
 * pay for the index's needs.
 *
 * <p>So the extra text lives here, is written to Solr, and is never returned. The searchable surface
 * of an object and its public shape are different things.
 */
public record DiscoveryDocument(
        SearchResult result, List<String> subjects, List<String> authors, String citation, String doi) {

    public DiscoveryDocument {
        subjects = subjects == null ? List.of() : List.copyOf(subjects);
        authors = authors == null ? List.of() : List.copyOf(authors);
    }

    /** A document with nothing extra to match on, which is every object seeded before this existed. */
    public static DiscoveryDocument of(SearchResult result) {
        return new DiscoveryDocument(result, List.of(), List.of(), null, null);
    }
}
