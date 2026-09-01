package org.civicsrepo.search;

/**
 * Decoded continuation state after token integrity and request binding have been validated.
 *
 * @param projectionId deterministic identity of the active normalized search projection
 * @param criteriaFingerprint normalized request/sort/page-size fingerprint
 * @param backend backend that owns {@code position}
 * @param page zero-based logical page returned when this cursor is consumed
 * @param position backend-native continuation position (for example Solr cursorMark)
 */
public record SearchCursorState(
        String projectionId,
        String criteriaFingerprint,
        String backend,
        int page,
        String position) {}
