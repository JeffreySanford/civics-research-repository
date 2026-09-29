package org.civicsrepo.sources;

import org.civicsrepo.generated.dto.ResearchProgram;
import org.civicsrepo.generated.dto.SyncSource;
import org.springframework.stereotype.Component;

/**
 * Restricted LEHD microdata metadata.
 *
 * <p>This adapter synchronizes descriptive metadata only. The catalog record intentionally contains
 * no files because the underlying Title 13 records are not held or redistributed by this repository.
 */
@Component
public class LehdMetadataAdapter extends CatalogBackedMetadataAdapter {

    public LehdMetadataAdapter(CatalogMetadataReader catalogMetadataReader) {
        super(catalogMetadataReader, SyncSource.LEHD, ResearchProgram.LEHD);
    }
}
