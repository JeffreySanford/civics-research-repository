package org.civicsrepo.repository;

import java.time.OffsetDateTime;

/**
 * What a source identifier became in the repository.
 *
 * <p>Every subsystem used to re-derive this independently. Sync looked an item up by discovery
 * search on each run, the projection keyed on the source identifier, and the UI routed on the same
 * string — and none of them recorded that {@code tiger-line-north-dakota-2025} *is* the item with
 * UUID {@code 7f27…}. The identifier was a search term rather than an identity.
 *
 * <p>Recording it closes the chain: source identifier -> DSpace UUID -> discovery document. That is
 * what lets a citation resolve, a version claim to supersede a specific item, and a relationship
 * point at something durable rather than at a string three services each interpret for themselves.
 *
 * @param sourceIdentifier the stable identifier the adapters assign
 * @param dspaceUuid the repository item it resolved to, absent until an apply has seen it
 * @param sourceUrl the publisher URL the object was harvested from
 * @param sourceCheckedAt when the publisher was last asked about it
 * @param indexedAt when the discovery projection last included it
 */
public record RepositoryIdentity(
        String sourceIdentifier,
        String dspaceUuid,
        String sourceUrl,
        OffsetDateTime sourceCheckedAt,
        OffsetDateTime indexedAt) {}
