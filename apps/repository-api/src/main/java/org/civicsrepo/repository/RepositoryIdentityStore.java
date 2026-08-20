package org.civicsrepo.repository;

import java.util.List;
import java.util.Optional;

/**
 * Records and reads the correspondence between a source identifier and the repository item it became.
 *
 * <p>An interface because the write side is called from the DSpace gateway and the projection, and
 * neither should depend on a JDBC class to say "this identifier is now that item".
 */
public interface RepositoryIdentityStore {

    /** Records the item a source identifier resolved to, and that the source was just consulted. */
    void recordDspaceItem(String sourceIdentifier, String dspaceUuid, String sourceUrl);

    /** Records that the discovery projection just included these objects. */
    void recordIndexed(List<String> sourceIdentifiers);

    Optional<RepositoryIdentity> findBySourceIdentifier(String sourceIdentifier);

    List<RepositoryIdentity> findAll();

    /** How many objects have a recorded DSpace UUID, which is the identity chain's weakest link. */
    int countWithDspaceUuid();
}
