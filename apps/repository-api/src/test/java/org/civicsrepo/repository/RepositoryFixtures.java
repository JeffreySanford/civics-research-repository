package org.civicsrepo.repository;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.stream.Collectors;

/** Builds DSpace item JSON so repository mapping tests read as metadata, not as nested JSON. */
final class RepositoryFixtures {
    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    private RepositoryFixtures() {}

    /** A fully populated item, as the DSpace seed plus a completed sync would leave it. */
    static JsonNode seededItem(String sourceIdentifier, String title, String program, String geography, String vintage) {
        Map<String, String> metadata = new LinkedHashMap<>();
        metadata.put("dc.title", title);
        metadata.put("dc.publisher", "U.S. Census Bureau");
        metadata.put("dc.description.abstract", "Abstract for " + title + ".");
        metadata.put("dc.coverage.spatial", geography);
        metadata.put("dc.date.issued", vintage + "-01-01");
        metadata.put("dc.identifier.citation", "U.S. Census Bureau. " + title + ".");
        metadata.put("dc.identifier.other", sourceIdentifier);
        metadata.put("crr.identifier.source", sourceIdentifier);
        metadata.put("crr.program", program);
        metadata.put("crr.geography.level", "Census tract");
        metadata.put("crr.vintage", vintage);
        metadata.put("crr.source.url", "https://www2.census.gov/geo/tiger/TIGER" + vintage + "/tl_" + vintage + ".zip");
        metadata.put("crr.documentation.url", "https://www.census.gov/programs-surveys/docs.pdf");
        return item("uuid-" + sourceIdentifier, title, metadata);
    }

    static JsonNode item(String uuid, String name, Map<String, String> metadata) {
        String valueTemplate =
                "\"%s\": [{\"value\": \"%s\", \"language\": \"en_US\", \"authority\": null, \"confidence\": -1}]";
        String metadataJson = metadata.entrySet().stream()
                .map((entry) -> valueTemplate.formatted(entry.getKey(), entry.getValue()))
                .collect(Collectors.joining(","));

        return parse("""
                {
                  "type": "item",
                  "uuid": "%s",
                  "name": "%s",
                  "withdrawn": false,
                  "metadata": {%s}
                }
                """
                .formatted(uuid, name, metadataJson));
    }

    private static JsonNode parse(String json) {
        try {
            return OBJECT_MAPPER.readTree(json);
        } catch (Exception exception) {
            throw new IllegalStateException("Invalid fixture JSON.", exception);
        }
    }
}
