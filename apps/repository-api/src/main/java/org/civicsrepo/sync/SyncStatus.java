package org.civicsrepo.sync;

public enum SyncStatus {
    QUEUED,
    RUNNING,
    DRY_RUN_COMPLETE,
    APPLIED,
    FAILED
}
