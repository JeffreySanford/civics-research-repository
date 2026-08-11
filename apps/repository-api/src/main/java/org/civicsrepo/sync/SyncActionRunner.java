package org.civicsrepo.sync;

import java.util.List;

@FunctionalInterface
public interface SyncActionRunner {
    void run(SyncRequest request, List<SyncAction> actions);
}
