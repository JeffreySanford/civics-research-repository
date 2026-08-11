package org.civicsrepo.maps;

import java.time.OffsetDateTime;

public record UsgsEarthquakeFeature(
        String id, String place, double magnitude, OffsetDateTime occurredAt, double latitude, double longitude) {}
