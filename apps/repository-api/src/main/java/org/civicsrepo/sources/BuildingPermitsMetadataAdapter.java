package org.civicsrepo.sources;

import org.civicsrepo.generated.dto.ResearchProgram;
import org.civicsrepo.generated.dto.SyncSource;
import org.springframework.stereotype.Component;

/** Building Permits Survey national release. */
@Component
public class BuildingPermitsMetadataAdapter extends CatalogBackedMetadataAdapter {

    public BuildingPermitsMetadataAdapter(CatalogMetadataReader catalogMetadataReader) {
        super(catalogMetadataReader, SyncSource.BUILDING_PERMITS, ResearchProgram.BUILDING_PERMITS);
    }
}
