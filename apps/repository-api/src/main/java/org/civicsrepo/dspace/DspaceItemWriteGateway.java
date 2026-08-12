package org.civicsrepo.dspace;

public interface DspaceItemWriteGateway {
    boolean ensureSourceIdentifier(String sourceIdentifier, String itemTitle);
}
