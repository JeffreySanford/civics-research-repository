package org.civicsrepo.spatial;

/** Validation state for publisher-supplied geometry retained in the research spatial sidecar. */
public enum SpatialGeometryStatus {
    VALID,
    ANTIMERIDIAN_CANDIDATE,
    NO_PUBLISHER_GEOMETRY,
    QUARANTINED
}
