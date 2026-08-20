package org.civicsrepo.sync;

import org.civicsrepo.generated.dto.SyncAction;
import org.civicsrepo.generated.dto.SyncRequest;
import java.util.List;

@FunctionalInterface
public interface SyncActionRunner {
    void run(SyncRequest request, List<SyncAction> actions, List<SourceObject> sourceObjects);
}
