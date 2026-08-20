package org.civicsrepo.sources;

import org.civicsrepo.generated.dto.ResearchProgram;
import org.civicsrepo.generated.dto.SyncSource;
import org.springframework.stereotype.Component;

/** USGS 3D Elevation Program national coverage. */
@Component
public class Usgs3depMetadataAdapter extends CatalogBackedMetadataAdapter {

    public Usgs3depMetadataAdapter(CatalogMetadataReader catalogMetadataReader) {
        super(catalogMetadataReader, SyncSource.USGS_3_DEP, ResearchProgram.USGS_3_DEP);
    }
}
