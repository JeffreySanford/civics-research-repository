package org.civicsrepo.sources;

import org.civicsrepo.generated.dto.ResearchProgram;
import org.civicsrepo.generated.dto.SyncSource;
import org.springframework.stereotype.Component;

/** American Community Survey public-use microdata, one object per state and territory. */
@Component
public class AcsPumsMetadataAdapter extends CatalogBackedMetadataAdapter {

    public AcsPumsMetadataAdapter(CatalogMetadataReader catalogMetadataReader) {
        super(catalogMetadataReader, SyncSource.ACS_PUMS, ResearchProgram.ACS);
    }
}
