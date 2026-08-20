package org.civicsrepo.sources;

import org.civicsrepo.generated.dto.ResearchProgram;
import org.civicsrepo.generated.dto.SyncSource;
import org.springframework.stereotype.Component;

/** Population Estimates Program national release. */
@Component
public class PopulationEstimatesMetadataAdapter extends CatalogBackedMetadataAdapter {

    public PopulationEstimatesMetadataAdapter(CatalogMetadataReader catalogMetadataReader) {
        super(catalogMetadataReader, SyncSource.POPULATION_ESTIMATES, ResearchProgram.POPULATION_ESTIMATES);
    }
}
