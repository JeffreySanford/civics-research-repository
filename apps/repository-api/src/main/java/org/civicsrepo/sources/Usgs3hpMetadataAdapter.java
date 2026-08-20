package org.civicsrepo.sources;

import org.civicsrepo.generated.dto.ResearchProgram;
import org.civicsrepo.generated.dto.SyncSource;
import org.springframework.stereotype.Component;

/** USGS 3D Hydrography Program national coverage. */
@Component
public class Usgs3hpMetadataAdapter extends CatalogBackedMetadataAdapter {

    public Usgs3hpMetadataAdapter(CatalogMetadataReader catalogMetadataReader) {
        super(catalogMetadataReader, SyncSource.USGS_3_HP, ResearchProgram.USGS_3_HP);
    }
}
