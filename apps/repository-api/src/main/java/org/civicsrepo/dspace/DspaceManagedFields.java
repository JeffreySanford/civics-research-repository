package org.civicsrepo.dspace;

import java.util.List;
import java.util.Set;

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

    /** Artifact-version provenance. Values are written only when actually observed. */
    public static final String VERSION_LABEL_FIELD = "crr.version.label";
    public static final String VERSION_DATE_FIELD = "crr.version.date";
    public static final String SOURCE_SHA256_FIELD = "crr.provenance.sha256";
    public static final String CAPTURED_AT_FIELD = "crr.provenance.capturedat";
    public static final String IS_VERSION_OF_FIELD = "crr.version.isversionof";
    public static final String SUPERSEDES_FIELD = "crr.version.supersedes";
    public static final String CHANGE_NOTE_FIELD = "crr.version.changenote";

    /**
     * Fields for which DSpace legitimately appends repository-owned values after deposit.
     *
     * <p>For example, DSpace adds its persistent handle URL to {@code dc.identifier.uri} when an
     * item is archived. Synchronization still requires every source URI to be present, but must not
     * remove or continuously diff against repository identifiers that DSpace owns.
     */
    private static final Set<String> REPOSITORY_AUGMENTED_FIELDS = Set.of("dc.identifier.uri");

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
            // nothing about access/provenance cannot clear richer metadata a seeded item carries.
            RESOURCE_TYPE_FIELD,
            ACCESS_FIELD,
            ACCESS_NOTE_FIELD,
            LICENSE_FIELD,
            DOI_FIELD,
            RESEARCHER_FIELD,
            RELATION_FIELD,
            VERSION_LABEL_FIELD,
            VERSION_DATE_FIELD,
            SOURCE_SHA256_FIELD,
            CAPTURED_AT_FIELD,
            IS_VERSION_OF_FIELD,
            SUPERSEDES_FIELD,
            CHANGE_NOTE_FIELD,
            SOURCE_IDENTIFIER_FIELD);

    public static boolean allowsRepositoryAdditionalValues(String field) {
        return REPOSITORY_AUGMENTED_FIELDS.contains(field);
    }

    private DspaceManagedFields() {}
}
