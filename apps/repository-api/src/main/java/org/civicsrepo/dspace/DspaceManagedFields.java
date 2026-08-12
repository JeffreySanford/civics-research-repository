package org.civicsrepo.dspace;

import java.util.List;

/**
 * The metadata fields synchronization owns.
 *
 * <p>One definition shared by the write gateway and the diff planner. They must agree: if the
 * planner compares a field apply does not write, the diff can never settle; if apply writes a field
 * the planner ignores, changes go unreported.
 *
 * <p>Everything outside this list belongs to DSpace — {@code dc.date.accessioned},
 * {@code dc.description.provenance}, handles, and the rest — and is deliberately left alone.
 * Comparing whole items rather than this subset is why {@code sync:diff} always reported
 * {@code UPDATE_ITEM}: DSpace's own bookkeeping fields could never match a source payload.
 */
public final class DspaceManagedFields {
    public static final String SOURCE_IDENTIFIER_FIELD = DspaceItemMatcher.SOURCE_IDENTIFIER_FIELD;

    public static final List<String> ALL = List.of(
            "dc.title",
            "dc.contributor.author",
            "dc.publisher",
            "dc.description.abstract",
            "dc.date.issued",
            "dc.identifier.uri",
            "dc.relation.uri",
            "dc.identifier.citation",
            "dc.subject",
            "dc.coverage.spatial",
            "crr.identifier.source",
            "crr.program",
            "crr.geography.level",
            "crr.vintage",
            "crr.source.url",
            "crr.documentation.url",
            DspaceFileManifest.FIELD,
            SOURCE_IDENTIFIER_FIELD);

    private DspaceManagedFields() {}
}
