package org.civicsrepo.sync;

import org.civicsrepo.generated.dto.SyncAction;
import org.civicsrepo.generated.dto.SyncMode;
import org.civicsrepo.generated.dto.SyncRequest;
import java.util.List;
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
    public void run(SyncRequest request, List<SyncAction> actions, List<SourceObject> sourceObjects) {
        if (request.getMode() == SyncMode.APPLY) {
            applyDspaceMetadata(sourceObjects);
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

    /**
     * Reconciles every harvested object, not the first one.
     *
     * <p>The source identifier used to be read back out of the planned actions, which worked only
     * because there was exactly one item in the plan. Carrying the identifier alongside its payload
     * is both simpler and correct for a source that publishes fifty-six of them.
     */
    private void applyDspaceMetadata(List<SourceObject> sourceObjects) {
        int updated = 0;
        int current = 0;

        for (SourceObject sourceObject : sourceObjects) {
            boolean changed =
                    dspaceItemWriteGateway.ensureItemMetadata(sourceObject.sourceIdentifier(), sourceObject.payload());
            if (changed) {
                updated++;
            } else {
                current++;
            }
        }

        // One line per source rather than per object: fifty-six "found current metadata" lines say
        // less than one line stating that fifty-six were current.
        LOGGER.info(
                "DSpace metadata reconciliation: {} updated, {} already current, {} objects total.",
                updated,
                current,
                sourceObjects.size());
    }
}
