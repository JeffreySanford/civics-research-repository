package org.civicsrepo.metadata;

/**
 * Source-authored guidance describing how a researcher may legitimately request or discover a
 * restricted research object. This metadata is descriptive only; its presence never grants access.
 */
public record ResearchAccessMetadata(
        String mechanism, String accessUrl, String instructions, String restrictionBasis) {}
