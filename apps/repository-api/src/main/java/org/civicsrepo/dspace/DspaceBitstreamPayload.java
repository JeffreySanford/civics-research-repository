package org.civicsrepo.dspace;

import org.civicsrepo.datasets.FileFormat;

public record DspaceBitstreamPayload(String name, String bundleName, FileFormat format, String sourceUrl, Long sizeBytes) {}
