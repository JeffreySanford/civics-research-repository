package org.civicsrepo.maps;

public record CensusAreaBoundary(
        String id,
        String label,
        String geography,
        double west,
        double south,
        double east,
        double north,
        double centerLatitude,
        double centerLongitude,
        double defaultZoom) {}
