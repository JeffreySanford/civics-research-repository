package org.civicsrepo.sources;

import org.civicsrepo.generated.dto.ResearchProgram;
import org.civicsrepo.generated.dto.SyncSource;
import org.springframework.stereotype.Component;

/** Economic Census national release. */
@Component
public class EconomicCensusMetadataAdapter extends CatalogBackedMetadataAdapter {

    public EconomicCensusMetadataAdapter(CatalogMetadataReader catalogMetadataReader) {
        super(catalogMetadataReader, SyncSource.ECONOMIC_CENSUS, ResearchProgram.ECONOMIC_CENSUS);
    }
}
