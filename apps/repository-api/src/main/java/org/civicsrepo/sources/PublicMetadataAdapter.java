package org.civicsrepo.sources;

import org.civicsrepo.generated.dto.SyncSource;

public interface PublicMetadataAdapter {
    SyncSource source();

    PublicDatasetMetadata firstVisualSlice();
}
