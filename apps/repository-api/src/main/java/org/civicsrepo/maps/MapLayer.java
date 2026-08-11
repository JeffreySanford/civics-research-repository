package org.civicsrepo.maps;

public record MapLayer(
        String id,
        String label,
        MapLayerType layerType,
        String sourceUrl,
        String attribution,
        boolean visibleByDefault) {}
