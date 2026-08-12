package org.civicsrepo.dspace;

public interface DspaceItemWriteGateway {
    boolean ensureItemMetadata(String sourceIdentifier, DspaceItemPayload sourcePayload);
}
