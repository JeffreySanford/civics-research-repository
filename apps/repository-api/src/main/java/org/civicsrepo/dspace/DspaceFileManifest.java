package org.civicsrepo.dspace;

import org.civicsrepo.generated.dto.FileFormat;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Encodes a dataset's file manifest as repeatable {@code crr.file.manifest} metadata.
 *
 * <p>The storage policy is that public datasets are represented by links and manifests rather than
 * mirrored copies, so the repository item carries no bitstreams for them. That left the file
 * manifest with nowhere to live in DSpace, which is why {@code sync:diff} could never report
 * {@code SKIP_ITEM}: the source payload always described files the repository had no way to hold.
 *
 * <p>Each manifest entry is one metadata value holding compact JSON. JSON rather than a delimited
 * string because a URL may contain any delimiter worth choosing, and this field is written and read
 * by machines on both ends.
 */
public final class DspaceFileManifest {
    public static final String FIELD = "crr.file.manifest";

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    private DspaceFileManifest() {}

    public static String encode(DspaceBitstreamPayload bitstream) {
        Map<String, Object> entry = new LinkedHashMap<>();
        entry.put("id", bitstream.id());
        entry.put("label", bitstream.name());
        entry.put("bundle", bitstream.bundleName());
        entry.put("format", bitstream.format() == null ? null : bitstream.format().name());
        entry.put("url", bitstream.sourceUrl());
        if (bitstream.sizeBytes() != null) {
            entry.put("sizeBytes", bitstream.sizeBytes());
        }

        try {
            return OBJECT_MAPPER.writeValueAsString(entry);
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("File manifest entry could not be serialized.", exception);
        }
    }

    /** Returns empty for anything unparseable, so one malformed value cannot break a dataset page. */
    public static Optional<DspaceBitstreamPayload> decode(String value) {
        if (value == null || value.isBlank()) {
            return Optional.empty();
        }

        try {
            JsonNode entry = OBJECT_MAPPER.readTree(value);
            if (!entry.isObject()) {
                return Optional.empty();
            }

            return Optional.of(new DspaceBitstreamPayload(
                    text(entry, "id"),
                    text(entry, "label") == null ? text(entry, "id") : text(entry, "label"),
                    text(entry, "bundle") == null ? "ORIGINAL" : text(entry, "bundle"),
                    format(text(entry, "format")),
                    text(entry, "url"),
                    entry.hasNonNull("sizeBytes") ? entry.get("sizeBytes").asLong() : null));
        } catch (JsonProcessingException exception) {
            return Optional.empty();
        }
    }

    public static List<DspaceMetadataValue> toMetadataValues(
            List<DspaceBitstreamPayload> bitstreams, String language) {
        return bitstreams.stream()
                .map((bitstream) -> new DspaceMetadataValue(encode(bitstream), language, null, -1))
                .toList();
    }

    private static String text(JsonNode entry, String field) {
        return entry.hasNonNull(field) ? entry.get(field).asText() : null;
    }

    private static FileFormat format(String value) {
        if (value == null) {
            return FileFormat.OTHER;
        }

        for (FileFormat format : FileFormat.values()) {
            if (format.name().equalsIgnoreCase(value)) {
                return format;
            }
        }
        return FileFormat.OTHER;
    }
}
