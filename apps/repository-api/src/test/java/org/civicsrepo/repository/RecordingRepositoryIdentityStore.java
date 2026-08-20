package org.civicsrepo.repository;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * An in-memory identity store for tests.
 *
 * <p>Real rather than a mock, because what these tests care about is the fact recorded, not the
 * call made: "after an apply, this source identifier resolves to that UUID" is an assertion about
 * state, and verifying an interaction instead would pass even if the store threw the value away.
 */
public class RecordingRepositoryIdentityStore implements RepositoryIdentityStore {
    private final Map<String, RepositoryIdentity> byIdentifier = new LinkedHashMap<>();
    private final List<String> indexed = new ArrayList<>();

    @Override
    public void recordDspaceItem(String sourceIdentifier, String dspaceUuid, String sourceUrl) {
        byIdentifier.put(
                sourceIdentifier,
                new RepositoryIdentity(sourceIdentifier, dspaceUuid, sourceUrl, null, null));
    }

    @Override
    public void recordIndexed(List<String> sourceIdentifiers) {
        indexed.addAll(sourceIdentifiers);
    }

    @Override
    public Optional<RepositoryIdentity> findBySourceIdentifier(String sourceIdentifier) {
        return Optional.ofNullable(byIdentifier.get(sourceIdentifier));
    }

    @Override
    public List<RepositoryIdentity> findAll() {
        return List.copyOf(byIdentifier.values());
    }

    @Override
    public int countWithDspaceUuid() {
        return (int) byIdentifier.values().stream()
                .filter((identity) -> identity.dspaceUuid() != null)
                .count();
    }

    /** Identifiers handed to {@link #recordIndexed}, in the order they arrived. */
    public List<String> indexedIdentifiers() {
        return List.copyOf(indexed);
    }
}
