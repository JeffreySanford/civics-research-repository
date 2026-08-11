package org.civicsrepo.datasets;

public record DatasetFile(String id, String label, FileFormat format, String url, Long sizeBytes) {}
