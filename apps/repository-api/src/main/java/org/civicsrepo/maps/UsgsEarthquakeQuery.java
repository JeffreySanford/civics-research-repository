package org.civicsrepo.maps;

public record UsgsEarthquakeQuery(
        double minMagnitude,
        int days,
        double minLatitude,
        double maxLatitude,
        double minLongitude,
        double maxLongitude) {}
