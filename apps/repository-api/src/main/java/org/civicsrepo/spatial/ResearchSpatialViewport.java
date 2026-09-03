package org.civicsrepo.spatial;

/** WGS84 viewport used to bound research spatial feature queries. */
public record ResearchSpatialViewport(double west, double south, double east, double north) {
    public ResearchSpatialViewport {
        requireFinite(west, "west");
        requireFinite(south, "south");
        requireFinite(east, "east");
        requireFinite(north, "north");
        if (west < -180.0 || west > 180.0 || east < -180.0 || east > 180.0) {
            throw new IllegalArgumentException("west and east must be between -180 and 180 degrees.");
        }
        if (south < -90.0 || south > 90.0 || north < -90.0 || north > 90.0) {
            throw new IllegalArgumentException("south and north must be between -90 and 90 degrees.");
        }
        if (south > north) {
            throw new IllegalArgumentException("south must be less than or equal to north.");
        }
    }

    public boolean crossesAntimeridian() {
        return west > east;
    }

    private static void requireFinite(double value, String field) {
        if (!Double.isFinite(value)) {
            throw new IllegalArgumentException(field + " must be a finite coordinate.");
        }
    }
}
