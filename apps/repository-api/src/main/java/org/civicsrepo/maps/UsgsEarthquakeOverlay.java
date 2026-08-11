package org.civicsrepo.maps;

import java.time.OffsetDateTime;
import java.util.List;

public record UsgsEarthquakeOverlay(
        String source,
        String sourceUrl,
        String attribution,
        OffsetDateTime updatedAt,
        OffsetDateTime staleAfter,
        boolean fallback,
        UsgsEarthquakeQuery query,
        List<UsgsEarthquakeFeature> features) {}
