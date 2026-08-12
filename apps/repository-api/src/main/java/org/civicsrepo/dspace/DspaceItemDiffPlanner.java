package org.civicsrepo.dspace;

import org.civicsrepo.sync.SyncAction;
import org.springframework.stereotype.Component;

@Component
public class DspaceItemDiffPlanner {
    private final DspaceItemStateReader dspaceItemStateReader;

    public DspaceItemDiffPlanner(DspaceItemStateReader dspaceItemStateReader) {
        this.dspaceItemStateReader = dspaceItemStateReader;
    }

    public SyncAction planItemDiff(String sourceIdentifier, DspaceItemPayload sourcePayload) {
        return dspaceItemStateReader
                .findMatchingItem(sourceIdentifier, sourcePayload)
                .map((existingPayload) -> planExistingItemDiff(sourceIdentifier, sourcePayload, existingPayload))
                .orElseGet(() -> new SyncAction(
                        "CREATE_ITEM",
                        sourcePayload.name(),
                        "DSpace item does not exist for source identifier " + sourceIdentifier + "; create item with "
                                + sourcePayload.metadata().size() + " metadata fields and "
                                + sourcePayload.bitstreams().size() + " bitstream manifest entries."));
    }

    private SyncAction planExistingItemDiff(
            String sourceIdentifier, DspaceItemPayload sourcePayload, DspaceItemPayload existingPayload) {
        if (sourcePayload.equals(existingPayload)) {
            return new SyncAction(
                    "SKIP_ITEM",
                    sourcePayload.name(),
                    "DSpace item is current for source identifier " + sourceIdentifier + "; no metadata or bitstream changes.");
        }

        return new SyncAction(
                "UPDATE_ITEM",
                sourcePayload.name(),
                "DSpace item exists for source identifier " + sourceIdentifier
                        + " but differs from the normalized source payload; update metadata and bitstream manifest.");
    }
}
