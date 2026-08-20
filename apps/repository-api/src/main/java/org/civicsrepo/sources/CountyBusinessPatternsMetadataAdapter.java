package org.civicsrepo.sources;

import org.civicsrepo.generated.dto.ResearchProgram;
import org.civicsrepo.generated.dto.SyncSource;
import org.springframework.stereotype.Component;

/** County Business Patterns national release. */
@Component
public class CountyBusinessPatternsMetadataAdapter extends CatalogBackedMetadataAdapter {

    public CountyBusinessPatternsMetadataAdapter(CatalogMetadataReader catalogMetadataReader) {
        super(catalogMetadataReader, SyncSource.COUNTY_BUSINESS_PATTERNS, ResearchProgram.COUNTY_BUSINESS_PATTERNS);
    }
}
