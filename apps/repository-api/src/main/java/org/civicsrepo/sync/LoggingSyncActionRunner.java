package org.civicsrepo.sync;

import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

@Component
public class LoggingSyncActionRunner implements SyncActionRunner {
    private static final Logger LOGGER = LoggerFactory.getLogger(LoggingSyncActionRunner.class);

    @Override
    public void run(SyncRequest request, List<SyncAction> actions) {
        for (SyncAction action : actions) {
            LOGGER.info(
                    "Sync {} action planned for source {}: {} -> {}.",
                    request.mode(),
                    request.source(),
                    action.actionType(),
                    action.target());
        }
    }
}
