package org.civicsrepo.sync;

import org.civicsrepo.generated.dto.SyncAction;
import org.civicsrepo.generated.dto.SyncMode;
import org.civicsrepo.generated.dto.SyncRequest;
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
        if (request.getMode() == SyncMode.APPLY) {
            applyDspaceMetadata(actions, sourcePayload);
        }

        for (SyncAction action : actions) {
            LOGGER.info(
                    "Sync {} action planned for source {}: {} -> {}. {}",
                    request.getMode(),
                    request.getSource(),
                    action.getActionType(),
                    action.getTarget(),
                    action.getDetail());
        }
    }

    private void applyDspaceMetadata(List<SyncAction> actions, Optional<DspaceItemPayload> sourcePayload) {
        String sourceIdentifier = actionTarget(actions, SyncAction.ActionTypeEnum.UPSERT_FILE_MANIFEST);
        if (sourceIdentifier.isBlank() || sourcePayload.isEmpty()) {
            return;
        }

        boolean changed = dspaceItemWriteGateway.ensureItemMetadata(sourceIdentifier, sourcePayload.orElseThrow());
        LOGGER.info(
                "DSpace Dublin Core metadata reconciliation {} for {}.",
                changed ? "updated metadata" : "found current metadata",
                sourceIdentifier);
    }

    /**
     * Typed as the enum, not as a String. The action type used to be a free-form String, and an
     * enum compared against a String literal compiles and is silently always false -- this lookup
     * would quietly stop matching and the metadata write would be skipped rather than fail.
     */
    private String actionTarget(List<SyncAction> actions, SyncAction.ActionTypeEnum actionType) {
        return actions.stream()
                .filter((action) -> action.getActionType() == actionType)
                .map(SyncAction::getTarget)
                .findFirst()
                .orElse("");
    }
}
