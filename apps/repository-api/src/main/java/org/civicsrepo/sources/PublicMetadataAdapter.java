package org.civicsrepo.sources;

import org.civicsrepo.sync.SyncSource;

public interface PublicMetadataAdapter {
    SyncSource source();

    PublicDatasetMetadata firstVisualSlice();
}
