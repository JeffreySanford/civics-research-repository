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

    /** Publisher URL, named so the identity store and this field list cannot drift apart. */
    public static final String SOURCE_URL_FIELD = "crr.source.url";

    public static final String RESOURCE_TYPE_FIELD = "crr.resource.type";
    public static final String ACCESS_FIELD = "crr.rights.access";
    public static final String ACCESS_NOTE_FIELD = "crr.rights.accessnote";
    public static final String LICENSE_FIELD = "crr.rights.license";
    public static final String DOI_FIELD = "crr.identifier.doi";
    public static final String RESEARCHER_FIELD = "crr.contributor.researcher";
    public static final String RELATION_FIELD = "crr.relation.edge";

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
            // Reconciled like every other managed field. Safe to add: a source payload with no
            // value for one of these is skipped rather than written empty, so a harvest that says
            // nothing about access cannot clear the access level a seeded item carries.
            RESOURCE_TYPE_FIELD,
            ACCESS_FIELD,
            ACCESS_NOTE_FIELD,
            LICENSE_FIELD,
            DOI_FIELD,
            RESEARCHER_FIELD,
            RELATION_FIELD,
            SOURCE_IDENTIFIER_FIELD);

    private DspaceManagedFields() {}
}
