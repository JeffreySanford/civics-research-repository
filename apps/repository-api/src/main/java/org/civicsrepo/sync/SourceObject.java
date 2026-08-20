package org.civicsrepo.sync;

import org.civicsrepo.dspace.DspaceItemPayload;

/**
 * One harvested object and the payload that would be written for it.
 *
 * <p>The identifier travels with the payload rather than being recovered from the planned actions.
 * Reading it back out of the plan worked only while a plan described exactly one item, and TIGER/Line
 * publishes fifty-six.
 */
public record SourceObject(String sourceIdentifier, DspaceItemPayload payload) {}
