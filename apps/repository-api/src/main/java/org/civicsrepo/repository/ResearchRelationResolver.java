package org.civicsrepo.repository;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.civicsrepo.generated.dto.AccessLevel;
import org.civicsrepo.generated.dto.ResearchObjectType;
import org.civicsrepo.generated.dto.ResearchRelation;
import org.civicsrepo.generated.dto.ResearchRelationVerb;
import org.civicsrepo.generated.dto.SearchResult;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Turns the typed edges stored on an item into relations a client can render.
 *
 * <p>The catalog stores an edge as a verb plus the source identifier of its target, because that is
 * the only part a curator can assert. The target's title, type and access level belong to the
 * target, and copying them into the edge would let the two drift: rename a paper and every
 * relation pointing at it would still show the old name. They are resolved here instead, against
 * the objects actually present.
 *
 * <p>An edge whose target is missing is dropped rather than rendered with a placeholder. The
 * generator refuses to emit one, so a missing target means the repository is holding less than the
 * catalog described — which is worth a log line and worth not showing as a working link.
 */
public final class ResearchRelationResolver {
    private static final Logger LOGGER = LoggerFactory.getLogger(ResearchRelationResolver.class);
    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    private ResearchRelationResolver() {}

    /** A relationship as stored: everything the curator asserted, nothing resolved yet. */
    public record RawEdge(ResearchRelationVerb verb, String target, String note) {}

    /**
     * Reads edges from JSON values, each {@code {"verb":..,"target":..,"note":..}}.
     *
     * <p>Accepts either a JSON array node or an iterable of string nodes, because the fixture
     * catalog stores them as an array and DSpace stores each one as a separate metadata value.
     */
    public static List<RawEdge> parse(Iterable<JsonNode> values) {
        List<RawEdge> edges = new ArrayList<>();
        for (JsonNode value : values) {
            JsonNode edge = value.isTextual() ? readTree(value.asText()) : value;
            if (edge == null) {
                continue;
            }

            String verb = edge.path("verb").asText("");
            String target = edge.path("target").asText("");
            if (verb.isBlank() || target.isBlank()) {
                continue;
            }

            // fromValue, never valueOf: the contract's verbs are camelCase ("hasPart"), so the
            // generated Java constant is HAS_PART and valueOf would throw on every edge.
            try {
                edges.add(new RawEdge(
                        ResearchRelationVerb.fromValue(verb),
                        target,
                        edge.path("note").isMissingNode() ? null : edge.path("note").asText()));
            } catch (IllegalArgumentException exception) {
                LOGGER.warn("Ignoring relation with unknown verb {}.", verb);
            }
        }
        return List.copyOf(edges);
    }

    /** Resolves each edge against the objects present, dropping any whose target is absent. */
    public static List<ResearchRelation> resolve(List<RawEdge> edges, Map<String, SearchResult> byId) {
        List<ResearchRelation> relations = new ArrayList<>();
        for (RawEdge edge : edges) {
            SearchResult target = byId.get(edge.target());
            if (target == null) {
                LOGGER.warn("Relation {} -> {} has no target in the catalog.", edge.verb(), edge.target());
                continue;
            }

            ResearchRelation relation = new ResearchRelation(
                    edge.verb(),
                    target.getId(),
                    target.getTitle(),
                    target.getContentType() == null ? ResearchObjectType.DATASET : target.getContentType());
            relation.setTargetAccessLevel(
                    target.getAccessLevel() == null ? AccessLevel.PUBLIC : target.getAccessLevel());
            if (edge.note() != null && !edge.note().isBlank()) {
                relation.setNote(edge.note());
            }
            relations.add(relation);
        }
        return List.copyOf(relations);
    }

    private static JsonNode readTree(String json) {
        try {
            return OBJECT_MAPPER.readTree(json);
        } catch (Exception exception) {
            LOGGER.warn("Ignoring unparseable relation value.");
            return null;
        }
    }
}
