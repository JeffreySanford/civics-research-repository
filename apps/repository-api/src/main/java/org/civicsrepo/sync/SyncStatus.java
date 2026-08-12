package org.civicsrepo.sync;

public enum SyncStatus {
    QUEUED,
    RUNNING,
    DIFF_COMPLETE,
    DRY_RUN_COMPLETE,
    APPLIED,
    FAILED
}
