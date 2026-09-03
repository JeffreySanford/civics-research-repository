package org.civicsrepo.spatial;

/** Raised when no activated spatial build exists for a requested federated source. */
public class ResearchSpatialCoverageUnavailableException extends RuntimeException {
    public ResearchSpatialCoverageUnavailableException(String message) {
        super(message);
    }
}
