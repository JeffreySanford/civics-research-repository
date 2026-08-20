package org.civicsrepo.sources;

import org.civicsrepo.generated.dto.ResearchProgram;
import org.civicsrepo.generated.dto.SyncSource;
import org.springframework.stereotype.Component;

/** Business Dynamics Statistics national release. */
@Component
public class BusinessDynamicsMetadataAdapter extends CatalogBackedMetadataAdapter {

    public BusinessDynamicsMetadataAdapter(CatalogMetadataReader catalogMetadataReader) {
        super(catalogMetadataReader, SyncSource.BUSINESS_DYNAMICS, ResearchProgram.BUSINESS_DYNAMICS);
    }
}
