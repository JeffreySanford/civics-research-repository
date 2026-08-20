package org.civicsrepo.dspace;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;

/**
 * Encodes researcher and relation metadata values.
 *
 * <p>These fields are repeatable JSON, one entry per value, and the encoding has to match what
 * {@code tools/scripts/generate-saf.mjs} writes for seeded items exactly. If the two disagree by a
 * key order or a null, a harvested object and a seeded one describe the same author differently and
 * {@code sync:diff} reports a change on every run without ever settling — the same failure the file
 * manifest had before its encoding was shared.
 *
 * <p>Absent rather than null for an unknown ORCID or note: the seed omits the key entirely, so
 * emitting {@code "orcid":null} here would produce a permanent difference.
 */
public final class ResearchObjectJson {
    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    private ResearchObjectJson() {}

    public static String author(String name, String orcid) {
        ObjectNode node = OBJECT_MAPPER.createObjectNode();
        node.put("name", name);
        if (orcid != null && !orcid.isBlank()) {
            node.put("orcid", orcid);
        }
        return node.toString();
    }

    public static String relation(String verb, String targetId, String note) {
        ObjectNode node = OBJECT_MAPPER.createObjectNode();
        node.put("verb", verb);
        node.put("target", targetId);
        if (note != null && !note.isBlank()) {
            node.put("note", note);
        }
        return node.toString();
    }
}
