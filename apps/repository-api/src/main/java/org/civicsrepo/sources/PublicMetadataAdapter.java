package org.civicsrepo.sources;

import java.util.List;
import org.civicsrepo.generated.dto.SyncSource;

/**
 * Normalizes one public source into research-object metadata.
 *
 * <p>{@link #harvest()} is what sync reconciles. {@link #firstVisualSlice()} remains the one object
 * an adapter would show if it could only show one, and is the default a single-object national
 * source needs: eleven of the fifteen programs publish exactly one file set, so making every
 * adapter implement enumeration would be ceremony for most of them.
 *
 * <p>Programs that publish per state override {@code harvest()}. TIGER/Line and LODES between them
 * account for 109 of the repository's 181 objects, and reconciling one apiece was the only reason
 * five objects had a recorded DSpace identity rather than a hundred.
 */
public interface PublicMetadataAdapter {
    SyncSource source();

    ResearchObjectMetadata firstVisualSlice();

    /** Every object this source publishes. One by default; per-area sources override it. */
    default List<ResearchObjectMetadata> harvest() {
        return List.of(firstVisualSlice());
    }
}
