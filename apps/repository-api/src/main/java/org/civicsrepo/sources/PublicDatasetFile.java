package org.civicsrepo.sources;

import org.civicsrepo.datasets.FileFormat;

public record PublicDatasetFile(String id, String label, FileFormat format, String url, Long sizeBytes) {}
