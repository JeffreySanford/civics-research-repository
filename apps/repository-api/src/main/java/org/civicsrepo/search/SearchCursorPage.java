package org.civicsrepo.search;

import org.civicsrepo.generated.dto.SearchResponse;

/**
 * One cursor-traversal page plus the opaque token for the following page.
 *
 * <p>The nested search response intentionally preserves the existing discovery payload unchanged
 * during migration. {@code nextCursor} is null on the terminal page. Clients must treat the token
 * as opaque and resend it only with the same effective query/filter/page-size state.
 */
public record SearchCursorPage(SearchResponse search, String nextCursor) {
    public SearchCursorPage {
        if (search == null) {
            throw new IllegalArgumentException("search is required");
        }
    }
}
