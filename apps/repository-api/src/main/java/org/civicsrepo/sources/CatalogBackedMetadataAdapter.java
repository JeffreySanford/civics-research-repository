package org.civicsrepo.sources;

import java.util.List;
import org.civicsrepo.generated.dto.ResearchProgram;
import org.civicsrepo.generated.dto.SyncSource;

/**
 * An adapter whose objects come from the catalog.
 *
 * <p>The first adapters were written before the catalog existed, so each compiled in an identifier,
 * a URL and a vintage. That is a second copy of what {@code tools/dspace/catalog.json} states, and
 * two copies drift: CPS spent its life pinned to a vintage the repository never seeded.
 *
 * <p>Subclasses declare a source and a program and nothing else. What that leaves them is the only
 * thing they should own — the decision that this program is worth harvesting — while which objects
 * exist stays in the one place that is generated, committed and checked.
 *
 * <p>Live publisher facts are deliberately absent here. Size and last-modified belong to the file
 * rather than to the catalog, and the adapters that need them probe for them; a national program
 * publishing one archive a year does not need a HEAD request on every sync to describe itself.
 */
public abstract class CatalogBackedMetadataAdapter implements PublicMetadataAdapter {
    private final CatalogMetadataReader catalogMetadataReader;
    private final SyncSource source;
    private final ResearchProgram program;

    protected CatalogBackedMetadataAdapter(
            CatalogMetadataReader catalogMetadataReader, SyncSource source, ResearchProgram program) {
        this.catalogMetadataReader = catalogMetadataReader;
        this.source = source;
        this.program = program;
    }

    @Override
    public SyncSource source() {
        return source;
    }

    @Override
    public List<ResearchObjectMetadata> harvest() {
        return catalogMetadataReader.forProgram(program);
    }

    /**
     * The first catalog object for this program.
     *
     * <p>For the eleven national programs that is also the only one. For a per-area program it is
     * whichever area sorts first, which is an arbitrary but stable choice: nothing about these
     * programs makes one area the demo's subject the way North Dakota is for TIGER/Line and LODES.
     */
    @Override
    public ResearchObjectMetadata firstVisualSlice() {
        List<ResearchObjectMetadata> objects = harvest();
        if (objects.isEmpty()) {
            throw new IllegalStateException(
                    "No catalog objects for " + program.getValue() + ". Run: pnpm run dspace:saf:generate");
        }
        return objects.getFirst();
    }
}
