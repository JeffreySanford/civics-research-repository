package org.civicsrepo.admin;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.io.InputStream;
import java.time.OffsetDateTime;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import org.civicsrepo.generated.dto.ResearchProgram;
import org.civicsrepo.generated.dto.SourceInventory;
import org.civicsrepo.generated.dto.SourceInventoryProgram;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * How much source data the repository is subscribed to.
 *
 * <p>Reads the inventory committed by {@code tools/scripts/build-source-inventory.mjs}. Sizes are
 * not measured here: asking 191 federal hosts for a file length on every request would be slow,
 * fragile, and rude, and the answer changes only when an agency reissues a file. The artifact
 * carries the date it was taken, and the API passes that through, because a byte total without an
 * as-of date is a number pretending to be current.
 *
 * <p>Subscribed is not stored. The repository holds metadata pointing at these files; the DSpace
 * assetstore holds none of their bytes. The gap between the two is the point of the design.
 */
@Service
public class SourceInventoryService {
    private static final Logger LOGGER = LoggerFactory.getLogger(SourceInventoryService.class);
    private static final String RESOURCE = "/source-inventory.json";

    private final SourceInventory inventory;

    public SourceInventoryService() {
        this(RESOURCE);
    }

    SourceInventoryService(String resource) {
        this.inventory = read(resource);
    }

    public SourceInventory inventory() {
        return inventory;
    }

    private SourceInventory read(String resource) {
        try (InputStream stream = SourceInventoryService.class.getResourceAsStream(resource)) {
            if (stream == null) {
                throw new IllegalStateException(
                        "Source inventory " + resource + " is missing. Run: pnpm run sources:inventory");
            }

            JsonNode root = new ObjectMapper().readTree(stream);
            SourceInventory result = new SourceInventory(
                    checkedAt(root),
                    root.path("objectCount").asInt(),
                    root.path("programCount").asInt(),
                    root.path("distinctFileCount").asInt(),
                    root.path("measuredFileCount").asInt(),
                    root.path("unreachableFileCount").asInt(),
                    root.path("totalBytes").asLong(),
                    programs(root.path("byProgram")));

            LOGGER.info(
                    "Source inventory loaded: {} objects, {} distinct files, {} bytes measured on {}.",
                    result.getObjectCount(),
                    result.getDistinctFileCount(),
                    result.getTotalBytes(),
                    result.getCheckedAt());
            return result;
        } catch (IOException exception) {
            throw new IllegalStateException("Source inventory " + resource + " could not be read.", exception);
        }
    }

    private OffsetDateTime checkedAt(JsonNode root) {
        try {
            return OffsetDateTime.parse(root.path("checkedAt").asText());
        } catch (DateTimeParseException exception) {
            throw new IllegalStateException(
                    "Source inventory has no usable checkedAt. Run: pnpm run sources:inventory", exception);
        }
    }

    private List<SourceInventoryProgram> programs(JsonNode node) {
        List<SourceInventoryProgram> programs = new ArrayList<>();
        for (JsonNode entry : node) {
            programs.add(new SourceInventoryProgram(
                    program(entry.path("program").asText()),
                    entry.path("objectCount").asInt(),
                    entry.path("fileCount").asInt(),
                    entry.path("measuredFileCount").asInt(),
                    entry.path("unreachableFileCount").asInt(),
                    entry.path("totalBytes").asLong()));
        }
        return List.copyOf(programs);
    }

    /** An unrecognized value reports as OTHER rather than failing the whole inventory. */
    private ResearchProgram program(String value) {
        try {
            return ResearchProgram.fromValue(value.toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException exception) {
            return ResearchProgram.OTHER;
        }
    }
}
