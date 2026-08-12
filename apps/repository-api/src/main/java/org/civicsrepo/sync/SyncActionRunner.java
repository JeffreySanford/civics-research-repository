package org.civicsrepo.sync;

import org.civicsrepo.generated.dto.SyncAction;
import org.civicsrepo.generated.dto.SyncRequest;
import java.util.List;
import java.util.Optional;
import org.civicsrepo.dspace.DspaceItemPayload;

@FunctionalInterface
public interface SyncActionRunner {
    void run(SyncRequest request, List<SyncAction> actions, Optional<DspaceItemPayload> sourcePayload);
}
