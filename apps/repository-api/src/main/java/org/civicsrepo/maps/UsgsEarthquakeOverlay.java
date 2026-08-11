package org.civicsrepo.maps;

import java.time.OffsetDateTime;
import java.util.List;

public record UsgsEarthquakeOverlay(String source, OffsetDateTime updatedAt, List<UsgsEarthquakeFeature> features) {}
