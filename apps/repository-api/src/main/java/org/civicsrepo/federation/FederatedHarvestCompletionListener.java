package org.civicsrepo.federation;

/** Side-effect hook invoked after a harvest run has durably reached COMPLETED. */
public interface FederatedHarvestCompletionListener {
    void onCompleted(HarvestRun run);
}
