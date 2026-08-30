package org.civicsrepo.federation;

/** Durable lifecycle for one bounded/resumable source harvest. */
public enum HarvestRunStatus {
    RUNNING,
    PAUSED,
    COMPLETED,
    FAILED,
    CANCELLED
}
