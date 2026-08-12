package org.civicsrepo.repository;

/**
 * Where a response's data actually came from.
 *
 * <p>Carried through the API so that fixture content is never silently presented as repository
 * content. A UI showing generated placeholders must be able to say so.
 */
public enum RepositorySource {
    /** DSpace is the source of record for these records. */
    REPOSITORY,

    /** DSpace was unavailable or empty; these are generated placeholders. */
    FIXTURE
}
