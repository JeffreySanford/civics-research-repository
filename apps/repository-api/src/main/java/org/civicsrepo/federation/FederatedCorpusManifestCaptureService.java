package org.civicsrepo.federation;

import org.springframework.stereotype.Service;

/** Generates and durably records the corpus identity produced by a completed harvest run. */
@Service
public class FederatedCorpusManifestCaptureService implements FederatedHarvestCompletionListener {
    private final FederatedCorpusManifestService manifestService;
    private final FederatedCorpusManifestStore manifestStore;

    public FederatedCorpusManifestCaptureService(
            FederatedCorpusManifestService manifestService, FederatedCorpusManifestStore manifestStore) {
        this.manifestService = manifestService;
        this.manifestStore = manifestStore;
    }

    public FederatedCorpusManifest capture(String runId) {
        FederatedCorpusManifest manifest = manifestService.generate(runId);
        manifestStore.save(manifest);
        return manifest;
    }

    @Override
    public void onCompleted(HarvestRun run) {
        capture(run.id());
    }
}
