package org.civicsrepo.sync;

import java.util.List;
import java.util.Optional;
import org.civicsrepo.dspace.DspaceItemPayload;
import org.civicsrepo.dspace.DspaceItemWriteGateway;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

@Component
public class LoggingSyncActionRunner implements SyncActionRunner {
    private static final Logger LOGGER = LoggerFactory.getLogger(LoggingSyncActionRunner.class);

    private final DspaceItemWriteGateway dspaceItemWriteGateway;

    public LoggingSyncActionRunner(DspaceItemWriteGateway dspaceItemWriteGateway) {
        this.dspaceItemWriteGateway = dspaceItemWriteGateway;
    }

    @Override
    public void run(SyncRequest request, List<SyncAction> actions, Optional<DspaceItemPayload> sourcePayload) {
        if (request.mode() == SyncMode.APPLY) {
            applyDspaceMetadata(actions, sourcePayload);
        }

        for (SyncAction action : actions) {
            LOGGER.info(
                    "Sync {} action planned for source {}: {} -> {}. {}",
                    request.mode(),
                    request.source(),
                    action.actionType(),
                    action.target(),
                    action.detail());
        }
    }

    private void applyDspaceMetadata(List<SyncAction> actions, Optional<DspaceItemPayload> sourcePayload) {
        String sourceIdentifier = actionTarget(actions, "UPSERT_FILE_MANIFEST");
        if (sourceIdentifier.isBlank() || sourcePayload.isEmpty()) {
            return;
        }

        boolean changed = dspaceItemWriteGateway.ensureItemMetadata(sourceIdentifier, sourcePayload.orElseThrow());
        LOGGER.info(
                "DSpace Dublin Core metadata reconciliation {} for {}.",
                changed ? "updated metadata" : "found current metadata",
                sourceIdentifier);
    }

    private String actionTarget(List<SyncAction> actions, String actionType) {
        return actions.stream()
                .filter((action) -> action.actionType().equals(actionType))
                .map(SyncAction::target)
                .findFirst()
                .orElse("");
    }
}
