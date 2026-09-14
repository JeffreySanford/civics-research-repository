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
import org.civicsrepo.generated.dto.AccessLevel;
import org.civicsrepo.generated.dto.FileFormat;
import org.civicsrepo.generated.dto.ResearchObjectType;
import org.civicsrepo.generated.dto.ResearchProgram;
import org.civicsrepo.metadata.ResearchAccessMetadata;
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
        return new ResearchObjectMetadata(
                text(item, "id"),
                text(item, "title"),
                program,
                text(item, "publisher"),
                text(item, "summary"),
                text(item, "geography"),
                text(item, "geographyLevel"),
                integerOrNull(item, "vintageYear"),
                releasedOn(text(item, "releasedOn")),
                text(item, "sourceUrl"),
                text(item, "documentationUrl"),
                text(item, "citation"),
                files(item),
                contentType(item),
                accessLevel(item),
                textOrNull(item, "accessNote"),
                textOrNull(item, "license"),
                textOrNull(item, "doi"),
                authors(item),
                relations(item),
                null,
                accessGuidance(item));
    }

    private List<ResearchObjectFile> files(JsonNode item) {
        List<ResearchObjectFile> files = new ArrayList<>();
        for (JsonNode file : item.path("files")) {
            files.add(new ResearchObjectFile(
                    text(file, "id"),
                    text(file, "label"),
                    format(text(file, "format")),
                    text(file, "url"),
                    null));
        }
        return List.copyOf(files);
    }

    private List<ResearchObjectMetadata.ResearchAuthorMetadata> authors(JsonNode item) {
        List<ResearchObjectMetadata.ResearchAuthorMetadata> authors = new ArrayList<>();
        for (JsonNode author : item.path("authors")) {
            String name = textOrNull(author, "name");
            if (name == null) {
                continue;
            }
            authors.add(new ResearchObjectMetadata.ResearchAuthorMetadata(
                    name, textOrNull(author, "orcid")));
        }
        return List.copyOf(authors);
    }

    private List<ResearchObjectMetadata.ResearchObjectRelation> relations(JsonNode item) {
        List<ResearchObjectMetadata.ResearchObjectRelation> relations = new ArrayList<>();
        for (JsonNode relation : item.path("relations")) {
            String verb = textOrNull(relation, "verb");
            String target = textOrNull(relation, "target");
            if (verb == null || target == null) {
                continue;
            }
            relations.add(new ResearchObjectMetadata.ResearchObjectRelation(
                    verb, target, textOrNull(relation, "note")));
        }
        return List.copyOf(relations);
    }

    private ResearchAccessMetadata accessGuidance(JsonNode item) {
        JsonNode guidance = item.path("accessGuidance");
        if (guidance.isMissingNode() || guidance.isNull() || !guidance.isObject()) {
            return null;
        }

        String mechanism = textOrNull(guidance, "mechanism");
        String accessUrl = textOrNull(guidance, "accessUrl");
        String instructions = textOrNull(guidance, "instructions");
        String restrictionBasis = textOrNull(guidance, "restrictionBasis");
        if (mechanism == null && accessUrl == null && instructions == null && restrictionBasis == null) {
            return null;
        }
        return new ResearchAccessMetadata(mechanism, accessUrl, instructions, restrictionBasis);
    }

    private ResearchObjectType contentType(JsonNode item) {
        String value = text(item, "contentType");
        if (value.isBlank()) {
            return ResearchObjectType.DATASET;
        }
        try {
            return ResearchObjectType.fromValue(value.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException exception) {
            LOGGER.warn("Unknown research object type {}; treating it as a dataset.", value);
            return ResearchObjectType.DATASET;
        }
    }

    private AccessLevel accessLevel(JsonNode item) {
        String value = text(item, "accessLevel");
        if (value.isBlank()) {
            return AccessLevel.PUBLIC;
        }
        try {
            return AccessLevel.fromValue(value.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException exception) {
            LOGGER.warn("Unknown access level {}; treating it as restricted.", value);
            return AccessLevel.RESTRICTED;
        }
    }

    private LocalDate releasedOn(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            return LocalDate.parse(value);
        } catch (DateTimeParseException exception) {
            LOGGER.warn("Invalid catalog release date {}; leaving it unknown.", value);
            return null;
        }
    }

    private Integer integerOrNull(JsonNode item, String field) {
        JsonNode value = item.path(field);
        return value.isIntegralNumber() && value.canConvertToInt() ? value.intValue() : null;
    }

    private String text(JsonNode item, String field) {
        return item.path(field).asText("");
    }

    private String textOrNull(JsonNode item, String field) {
        String value = text(item, field).trim();
        return value.isEmpty() ? null : value;
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
