package org.civicsrepo.sync;

import java.util.List;
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
    public void run(SyncRequest request, List<SyncAction> actions) {
        if (request.mode() == SyncMode.APPLY) {
            applyDspaceIdentifier(actions);
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

    private void applyDspaceIdentifier(List<SyncAction> actions) {
        String itemTitle = actionTarget(actions, "UPSERT_ITEM");
        String sourceIdentifier = actionTarget(actions, "UPSERT_FILE_MANIFEST");
        if (itemTitle.isBlank() || sourceIdentifier.isBlank()) {
            return;
        }

        boolean changed = dspaceItemWriteGateway.ensureSourceIdentifier(sourceIdentifier, itemTitle);
        LOGGER.info(
                "DSpace source identifier reconciliation {} for {}.",
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
