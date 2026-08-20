package org.civicsrepo.sources;

import org.civicsrepo.generated.dto.FileFormat;

public record ResearchObjectFile(String id, String label, FileFormat format, String url, Long sizeBytes) {}
