package org.civicsrepo.sources;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.io.InputStream;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import org.civicsrepo.generated.dto.FileFormat;
import org.civicsrepo.generated.dto.ResearchProgram;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * Reads harvestable objects for a program from the generated catalog.
 *
 * <p>Adapters used to carry their object as hardcoded constants — an identifier, a URL, a vintage —
 * which was a second copy of what {@code tools/dspace/catalog.json} already states. Two copies drift:
 * the CPS adapter was pinned to {@code cps-public-use-2025} while the catalog seeded
 * {@code cps-public-use-2026}, so apply searched for an item that does not exist and failed on every
 * run, invisibly, because nothing had ever run that source.
 *
 * <p>Reading the catalog makes that class of bug impossible. The generated
 * {@code discovery-fixture-catalog.json} is on the classpath, is written by the same script that
 * produces the SAF packages, and is checked by {@code pnpm run fixture:check} — so an adapter and
 * the seeded repository cannot disagree about which objects exist.
 *
 * <p>This is not publisher discovery. The catalog is a curated list of which files exist and for
 * which vintages; harvesting it from Census and USGS APIs is separate, open work. What the adapters
 * add on top is live publisher fact — size and last-modified — which is why they still probe.
 */
@Component
public class CatalogMetadataReader {
    private static final Logger LOGGER = LoggerFactory.getLogger(CatalogMetadataReader.class);
    private static final String RESOURCE = "/discovery-fixture-catalog.json";

    private final List<ResearchObjectMetadata> objects;

    public CatalogMetadataReader() {
        this(RESOURCE);
    }

    CatalogMetadataReader(String resource) {
        this.objects = read(resource);
        LOGGER.info("Catalog metadata reader loaded {} harvestable research objects.", objects.size());
    }

    /** Every catalog object for one program, in catalog order. */
    public List<ResearchObjectMetadata> forProgram(ResearchProgram program) {
        return objects.stream()
                .filter((object) -> object.program() == program)
                .toList();
    }

    private List<ResearchObjectMetadata> read(String resource) {
        try (InputStream stream = CatalogMetadataReader.class.getResourceAsStream(resource)) {
            if (stream == null) {
                throw new IllegalStateException(
                        "Catalog " + resource + " is missing. Run: pnpm run dspace:saf:generate");
            }

            List<ResearchObjectMetadata> parsed = new ArrayList<>();
            for (JsonNode item : new ObjectMapper().readTree(stream).path("items")) {
                ResearchProgram program = program(item.path("program").asText(""));
                if (program == null) {
                    continue;
                }
                parsed.add(toMetadata(item, program));
            }
            return List.copyOf(parsed);
        } catch (IOException exception) {
            throw new IllegalStateException("Catalog " + resource + " could not be read.", exception);
        }
    }

    private ResearchObjectMetadata toMetadata(JsonNode item, ResearchProgram program) {
        List<ResearchObjectFile> files = new ArrayList<>();
        for (JsonNode file : item.path("files")) {
            files.add(new ResearchObjectFile(
                    file.path("id").asText(),
                    file.path("label").asText(),
                    format(file.path("format").asText("")),
                    file.path("url").asText(),
                    null));
        }

        return ResearchObjectMetadata.dataset(
                item.path("id").asText(),
                item.path("title").asText(),
                program,
                item.path("publisher").asText(),
                item.path("summary").asText(),
                item.path("geography").asText(),
                item.path("geographyLevel").asText(),
                item.path("vintageYear").asInt(),
                releasedOn(item.path("releasedOn").asText("")),
                item.path("sourceUrl").asText(),
                item.path("documentationUrl").asText(),
                item.path("citation").asText(),
                List.copyOf(files));
    }

    private LocalDate releasedOn(String value) {
        try {
            return value.isBlank() ? LocalDate.now() : LocalDate.parse(value);
        } catch (DateTimeParseException exception) {
            return LocalDate.now();
        }
    }

    /** fromValue, never valueOf: the generated constant and the contract value differ for USGS_3DEP. */
    private ResearchProgram program(String value) {
        if (value.isBlank()) {
            return null;
        }
        try {
            return ResearchProgram.fromValue(value.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException exception) {
            return null;
        }
    }

    private FileFormat format(String value) {
        try {
            return FileFormat.fromValue(value.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException exception) {
            return FileFormat.OTHER;
        }
    }
}
