package org.civicsrepo.dspace;

import java.util.stream.Collectors;
import java.util.stream.Stream;

/** Builds DSpace discovery response bodies so tests read as item lists rather than nested JSON. */
final class DspaceDiscoveryFixtures {
    private DspaceDiscoveryFixtures() {}

    /** Wraps raw {@code indexableObject} JSON bodies in the discovery envelope DSpace returns. */
    static String discoveryResponse(String... indexableObjects) {
        String objects = Stream.of(indexableObjects)
                .map((object) -> "{\"_embedded\": {\"indexableObject\": " + object + "}}")
                .collect(Collectors.joining(","));

        return """
                {
                  "_embedded": {
                    "searchResult": {
                      "_embedded": {
                        "objects": [%s]
                      }
                    }
                  }
                }
                """
                .formatted(objects);
    }

    static String item(String uuid, String title, String sourceIdentifier) {
        String sourceIdentifierMetadata = sourceIdentifier == null
                ? ""
                : ", \"dc.identifier.other\": [%s]".formatted(metadataValue(sourceIdentifier));

        return """
                {
                  "type": "item",
                  "uuid": "%s",
                  "name": "%s",
                  "withdrawn": false,
                  "metadata": {"dc.title": [%s]%s}
                }
                """
                .formatted(uuid, title, metadataValue(title), sourceIdentifierMetadata);
    }

    static String withdrawnItem(String uuid, String title) {
        return """
                {"type": "item", "uuid": "%s", "name": "%s", "withdrawn": true, "metadata": {}}
                """
                .formatted(uuid, title);
    }

    static String collection(String uuid, String name) {
        return """
                {"type": "collection", "uuid": "%s", "name": "%s", "metadata": {}}
                """
                .formatted(uuid, name);
    }

    private static String metadataValue(String value) {
        return """
                {"value": "%s", "language": "en_US", "authority": null, "confidence": -1}
                """
                .formatted(value);
    }
}
