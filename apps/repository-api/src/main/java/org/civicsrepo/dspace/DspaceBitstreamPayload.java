package org.civicsrepo.dspace;

import org.civicsrepo.generated.dto.FileFormat;

/**
 * One entry in a dataset's file manifest.
 *
 * @param id stable source-assigned identifier, used as the key on the dataset page
 * @param name human-readable label
 */
public record DspaceBitstreamPayload(
        String id, String name, String bundleName, FileFormat format, String sourceUrl, Long sizeBytes) {}
