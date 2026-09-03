package org.civicsrepo.spatial;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/** Conservative structural analysis for Data.gov publisher GeoJSON and source point evidence. */
public final class DataGovSpatialGeometryAnalyzer {
    private DataGovSpatialGeometryAnalyzer() {}

    public static GeometryAnalysis analyze(JsonNode geometry) {
        if (geometry == null || !geometry.isObject()) {
            return GeometryAnalysis.quarantined("UNKNOWN", "geometry is not a GeoJSON object");
        }
        String type = text(geometry.get("type"));
        if (type == null) {
            return GeometryAnalysis.quarantined("UNKNOWN", "geometry type is missing");
        }

        Accumulator accumulator = new Accumulator();
        List<String> problems = new ArrayList<>();
        boolean structurallyValid = analyzeType(type, geometry, accumulator, problems);
        Bounds bounds = accumulator.positionCount == 0
                ? null
                : new Bounds(accumulator.minLon, accumulator.minLat, accumulator.maxLon, accumulator.maxLat);
        if (!accumulator.coordinateDomainValid) {
            problems.add("one or more coordinates are outside the WGS84 longitude/latitude domain");
        }
        if (!structurallyValid || !accumulator.coordinateDomainValid || bounds == null) {
            return new GeometryAnalysis(
                    type,
                    SpatialGeometryStatus.QUARANTINED,
                    bounds,
                    accumulator.positionCount,
                    List.copyOf(problems));
        }
        SpatialGeometryStatus status = bounds.longitudeSpan() > 180.0
                ? SpatialGeometryStatus.ANTIMERIDIAN_CANDIDATE
                : SpatialGeometryStatus.VALID;
        return new GeometryAnalysis(type, status, bounds, accumulator.positionCount, List.copyOf(problems));
    }

    public static Point normalizeCentroid(JsonNode value, ObjectMapper objectMapper) {
        if (value == null || value.isNull() || value.isMissingNode()) {
            return null;
        }
        if (value.isTextual()) {
            String raw = value.asText().trim();
            if (raw.isEmpty()) {
                return null;
            }
            if (raw.startsWith("{") || raw.startsWith("[")) {
                try {
                    return normalizeCentroid(objectMapper.readTree(raw), objectMapper);
                } catch (Exception ignored) {
                    return null;
                }
            }
            String upper = raw.toUpperCase(Locale.ROOT);
            if (upper.startsWith("POINT") && raw.contains("(") && raw.endsWith(")")) {
                String body = raw.substring(raw.indexOf('(') + 1, raw.length() - 1).trim();
                String[] parts = body.split("\\s+");
                if (parts.length >= 2) {
                    return validPoint(number(parts[0]), number(parts[1]));
                }
            }
            return null;
        }
        if (value.isArray()) {
            return positionPoint(value);
        }
        if (!value.isObject()) {
            return null;
        }
        String type = text(value.get("type"));
        if ("Point".equals(type)) {
            return positionPoint(value.get("coordinates"));
        }
        Point coordinates = positionPoint(value.get("coordinates"));
        if (coordinates != null) {
            return coordinates;
        }
        Point latLon = validPoint(number(value.get("lon")), number(value.get("lat")));
        if (latLon != null) {
            return latLon;
        }
        Point latLng = validPoint(number(value.get("lng")), number(value.get("lat")));
        if (latLng != null) {
            return latLng;
        }
        return validPoint(number(value.get("longitude")), number(value.get("latitude")));
    }

    private static boolean analyzeType(
            String type, JsonNode geometry, Accumulator accumulator, List<String> problems) {
        return switch (type) {
            case "Point" -> analyzePoint(geometry.get("coordinates"), accumulator, problems);
            case "MultiPoint" -> analyzePositionArray(geometry.get("coordinates"), accumulator, problems, 1, "MultiPoint");
            case "LineString" -> analyzePositionArray(geometry.get("coordinates"), accumulator, problems, 2, "LineString");
            case "MultiLineString" -> analyzeMultiLine(geometry.get("coordinates"), accumulator, problems);
            case "Polygon" -> analyzePolygon(geometry.get("coordinates"), accumulator, problems);
            case "MultiPolygon" -> analyzeMultiPolygon(geometry.get("coordinates"), accumulator, problems);
            case "GeometryCollection" -> analyzeGeometryCollection(geometry.get("geometries"), accumulator, problems);
            default -> {
                problems.add("unsupported GeoJSON geometry type: " + type);
                yield false;
            }
        };
    }

    private static boolean analyzePoint(JsonNode position, Accumulator accumulator, List<String> problems) {
        if (!isPosition(position)) {
            problems.add("Point coordinates are not a valid position");
            return false;
        }
        accumulator.accept(position);
        return true;
    }

    private static boolean analyzePositionArray(
            JsonNode positions,
            Accumulator accumulator,
            List<String> problems,
            int minimum,
            String label) {
        if (positions == null || !positions.isArray() || positions.size() < minimum) {
            problems.add(label + " has fewer than " + minimum + " positions");
            return false;
        }
        boolean valid = true;
        for (JsonNode position : positions) {
            if (!isPosition(position)) {
                valid = false;
                problems.add(label + " contains an invalid position");
                continue;
            }
            accumulator.accept(position);
        }
        return valid;
    }

    private static boolean analyzeMultiLine(JsonNode lines, Accumulator accumulator, List<String> problems) {
        if (lines == null || !lines.isArray() || lines.isEmpty()) {
            problems.add("MultiLineString has no lines");
            return false;
        }
        boolean valid = true;
        for (JsonNode line : lines) {
            valid &= analyzePositionArray(line, accumulator, problems, 2, "MultiLineString line");
        }
        return valid;
    }

    private static boolean analyzePolygon(JsonNode rings, Accumulator accumulator, List<String> problems) {
        if (rings == null || !rings.isArray() || rings.isEmpty()) {
            problems.add("Polygon has no rings");
            return false;
        }
        boolean valid = true;
        for (JsonNode ring : rings) {
            if (ring == null || !ring.isArray() || ring.size() < 4) {
                valid = false;
                problems.add("Polygon ring has fewer than four positions");
                continue;
            }
            JsonNode first = ring.get(0);
            JsonNode last = ring.get(ring.size() - 1);
            if (!samePosition(first, last)) {
                valid = false;
                problems.add("Polygon ring is not closed");
            }
            for (JsonNode position : ring) {
                if (!isPosition(position)) {
                    valid = false;
                    problems.add("Polygon ring contains an invalid position");
                    continue;
                }
                accumulator.accept(position);
            }
        }
        return valid;
    }

    private static boolean analyzeMultiPolygon(JsonNode polygons, Accumulator accumulator, List<String> problems) {
        if (polygons == null || !polygons.isArray() || polygons.isEmpty()) {
            problems.add("MultiPolygon has no polygons");
            return false;
        }
        boolean valid = true;
        for (JsonNode polygon : polygons) {
            valid &= analyzePolygon(polygon, accumulator, problems);
        }
        return valid;
    }

    private static boolean analyzeGeometryCollection(
            JsonNode geometries, Accumulator accumulator, List<String> problems) {
        if (geometries == null || !geometries.isArray() || geometries.isEmpty()) {
            problems.add("GeometryCollection has no geometries");
            return false;
        }
        boolean valid = true;
        for (JsonNode geometry : geometries) {
            if (geometry == null || !geometry.isObject()) {
                valid = false;
                problems.add("GeometryCollection contains a non-object geometry");
                continue;
            }
            String type = text(geometry.get("type"));
            if (type == null) {
                valid = false;
                problems.add("GeometryCollection member is missing type");
                continue;
            }
            valid &= analyzeType(type, geometry, accumulator, problems);
        }
        return valid;
    }

    private static boolean isPosition(JsonNode position) {
        return position != null
                && position.isArray()
                && position.size() >= 2
                && number(position.get(0)) != null
                && number(position.get(1)) != null;
    }

    private static boolean samePosition(JsonNode left, JsonNode right) {
        if (!isPosition(left) || !isPosition(right)) {
            return false;
        }
        return Double.compare(left.get(0).asDouble(), right.get(0).asDouble()) == 0
                && Double.compare(left.get(1).asDouble(), right.get(1).asDouble()) == 0;
    }

    private static Point positionPoint(JsonNode position) {
        if (!isPosition(position)) {
            return null;
        }
        return validPoint(number(position.get(0)), number(position.get(1)));
    }

    private static Point validPoint(Double lon, Double lat) {
        if (lon == null || lat == null || !Double.isFinite(lon) || !Double.isFinite(lat)) {
            return null;
        }
        if (lon < -180 || lon > 180 || lat < -90 || lat > 90) {
            return null;
        }
        return new Point(lon, lat);
    }

    private static Double number(JsonNode node) {
        if (node == null || !node.isNumber()) {
            return null;
        }
        double value = node.asDouble();
        return Double.isFinite(value) ? value : null;
    }

    private static Double number(String value) {
        try {
            double parsed = Double.parseDouble(value);
            return Double.isFinite(parsed) ? parsed : null;
        } catch (RuntimeException ignored) {
            return null;
        }
    }

    private static String text(JsonNode node) {
        if (node == null || !node.isTextual() || node.asText().isBlank()) {
            return null;
        }
        return node.asText().trim();
    }

    public record Point(double lon, double lat) {
        public boolean within(Bounds bounds) {
            return bounds != null
                    && lon >= bounds.minLon()
                    && lon <= bounds.maxLon()
                    && lat >= bounds.minLat()
                    && lat <= bounds.maxLat();
        }
    }

    public record Bounds(double minLon, double minLat, double maxLon, double maxLat) {
        public double longitudeSpan() {
            return maxLon - minLon;
        }

        public Point center() {
            return new Point((minLon + maxLon) / 2.0, (minLat + maxLat) / 2.0);
        }
    }

    public record GeometryAnalysis(
            String geometryType,
            SpatialGeometryStatus status,
            Bounds bounds,
            long positionCount,
            List<String> problems) {
        static GeometryAnalysis quarantined(String type, String problem) {
            return new GeometryAnalysis(type, SpatialGeometryStatus.QUARANTINED, null, 0, List.of(problem));
        }

        public boolean queryable() {
            return status != SpatialGeometryStatus.QUARANTINED && bounds != null;
        }
    }

    private static final class Accumulator {
        private double minLon = Double.POSITIVE_INFINITY;
        private double minLat = Double.POSITIVE_INFINITY;
        private double maxLon = Double.NEGATIVE_INFINITY;
        private double maxLat = Double.NEGATIVE_INFINITY;
        private long positionCount;
        private boolean coordinateDomainValid = true;

        private void accept(JsonNode position) {
            double lon = position.get(0).asDouble();
            double lat = position.get(1).asDouble();
            positionCount += 1;
            minLon = Math.min(minLon, lon);
            minLat = Math.min(minLat, lat);
            maxLon = Math.max(maxLon, lon);
            maxLat = Math.max(maxLat, lat);
            if (!Double.isFinite(lon)
                    || !Double.isFinite(lat)
                    || lon < -180
                    || lon > 180
                    || lat < -90
                    || lat > 90) {
                coordinateDomainValid = false;
            }
        }
    }
}
