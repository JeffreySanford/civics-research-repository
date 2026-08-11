package org.civicsrepo.datasets;

import java.time.LocalDate;

public record DatasetVersion(String id, String label, LocalDate releasedOn, boolean current) {}
