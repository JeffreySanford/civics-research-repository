package org.civicsrepo.sources;

import org.civicsrepo.generated.dto.ResearchProgram;
import org.civicsrepo.generated.dto.SyncSource;
import org.springframework.stereotype.Component;

/** Small Area Income and Poverty Estimates national release. */
@Component
public class SaipeMetadataAdapter extends CatalogBackedMetadataAdapter {

    public SaipeMetadataAdapter(CatalogMetadataReader catalogMetadataReader) {
        super(catalogMetadataReader, SyncSource.SAIPE, ResearchProgram.SAIPE);
    }
}
