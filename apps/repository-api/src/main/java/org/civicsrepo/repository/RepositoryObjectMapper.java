package org.civicsrepo.repository;

import java.net.URI;
import org.civicsrepo.generated.dto.ResearchObjectDetail;
import org.civicsrepo.generated.dto.DatasetFile;
import org.civicsrepo.generated.dto.EvidenceStatus;
import org.civicsrepo.generated.dto.FileFormat;
import org.civicsrepo.generated.dto.AccessLevel;
import org.civicsrepo.generated.dto.ResearchAuthor;
import org.civicsrepo.generated.dto.ResearchObjectOrigin;
import org.civicsrepo.generated.dto.ResearchObjectType;
import org.civicsrepo.generated.dto.ResearchProgram;
import org.civicsrepo.generated.dto.SearchResult;
import org.civicsrepo.generated.dto.RepositorySource;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import org.civicsrepo.dspace.DspaceFileManifest;
import org.civicsrepo.search.DiscoveryDocument;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * Turns a DSpace item into the domain objects the API serves.
 *
 * <p>This is the inverse of {@code DspaceItemPayloadMapper}, and it is what makes DSpace the source
 * of record for reads rather than only for writes. Discovery and dataset detail were previously
 * served from generated fixtures while DSpace held the synchronized item, so the repository was
 * written to and never read from.
 *
 * <p>Pure and offline: every method takes a parsed item and returns domain types, so the mapping
 * rules are testable without a running DSpace.
 */
@Component
public class RepositoryObjectMapper {
    private static final Logger LOGGER = LoggerFactory.getLogger(RepositoryObjectMapper.class);
    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();
    private static final String PUBLISHER_FALLBACK = "U.S. Census Bureau";

    public SearchResult toSearchResult(JsonNode item) {
        String geography = firstValue(item, "dc.coverage.spatial").orElse("United States");
        ResearchProgram researchProgram = program(item);

        return new SearchResult(
                identifier(item),
                title(item),
                contentType(item),
                researchProgram,
                firstValue(item, "dc.publisher").orElse(PUBLISHER_FALLBACK),
                firstValue(item, "dc.description.abstract").orElse(""),
                URI.create(sourceUrl(item)),
                ResearchObjectOrigin.REPOSITORY,
                ResearchSourceSystemClassifier.forProgram(researchProgram))
                .geography(geography)
                .vintageYear(vintageYear(item).orElse(null))
                .accessLevel(accessLevel(item));
    }

    public ResearchObjectDetail toResearchObjectDetail(JsonNode item, List<SearchResult> relatedResearch) {
        ResearchProgram researchProgram = program(item);
        return new ResearchObjectDetail(
                RepositorySource.REPOSITORY,
                identifier(item),
                title(item),
                researchProgram,
                firstValue(item, "dc.publisher").orElse(PUBLISHER_FALLBACK),
                firstValue(item, "dc.description.abstract").orElse(""),
                files(item),
                firstValue(item, "dc.identifier.citation").orElse(title(item)),
                URI.create(sourceUrl(item)),
                relatedResearch,
                ResearchObjectOrigin.REPOSITORY,
                ResearchSourceSystemClassifier.forProgram(researchProgram))
                .geography(firstValue(item, "dc.coverage.spatial").orElse("United States"))
                .vintageYear(vintageYear(item).orElse(null))
                .releasedOn(releasedOn(item).orElse(null))
                .contentType(contentType(item))
                .accessLevel(accessLevel(item))
                .accessNote(firstValue(item, "crr.rights.accessnote").orElse(null))
                .license(firstValue(item, "crr.rights.license").orElse(null))
                .doi(firstValue(item, "crr.identifier.doi").orElse(null))
                .authors(authors(item))
                .accessibilityEvidenceStatus(EvidenceStatus.AUTOMATED_PASS);
    }

    /** The search result plus the text worth matching on but not worth returning. */
    public DiscoveryDocument toDiscoveryDocument(JsonNode item) {
        return new DiscoveryDocument(
                toSearchResult(item),
                allValues(item, "dc.subject"),
                authors(item).stream().map(ResearchAuthor::getName).toList(),
                firstValue(item, "dc.identifier.citation").orElse(null),
                firstValue(item, "crr.identifier.doi").orElse(null));
    }

    /** The typed edges stored on the item, still unresolved: the mapper cannot see other items. */
    public List<ResearchRelationResolver.RawEdge> edges(JsonNode item) {
        // DSpace wraps every metadata value as {"value": ..., "language": ...}. The resolver reads
        // the stored JSON, so it has to be handed the inner text rather than the wrapper.
        List<JsonNode> values = new ArrayList<>();
        for (JsonNode value : item.path("metadata").path("crr.relation.edge")) {
            values.add(value.path("value"));
        }
        return ResearchRelationResolver.parse(values);
    }

    /**
     * Type comes from {@code crr.resource.type}, defaulting to DATASET.
     *
     * <p>The default is a fact rather than a guess: every item seeded before research packages
     * existed was a dataset, because the catalog held nothing else. An unreadable value is logged
     * and treated the same way, so one bad item cannot fail a whole search response.
     */
    private ResearchObjectType contentType(JsonNode item) {
        return firstValue(item, "crr.resource.type")
                .map((value) -> {
                    try {
                        return ResearchObjectType.fromValue(value.trim());
                    } catch (IllegalArgumentException exception) {
                        LOGGER.warn("Unknown research object type {}; treating it as a dataset.", value);
                        return ResearchObjectType.DATASET;
                    }
                })
                .orElse(ResearchObjectType.DATASET);
    }

    /**
     * Access level comes from {@code crr.rights.access}, defaulting to PUBLIC.
     *
     * <p>An unreadable value falls back to RESTRICTED, not PUBLIC. Getting this backwards would
     * mean an item whose access metadata is corrupt renders as freely available.
     */
    private AccessLevel accessLevel(JsonNode item) {
        return firstValue(item, "crr.rights.access")
                .map((value) -> {
                    try {
                        return AccessLevel.fromValue(value.trim());
                    } catch (IllegalArgumentException exception) {
                        LOGGER.warn("Unknown access level {}; treating it as restricted.", value);
                        return AccessLevel.RESTRICTED;
                    }
                })
                .orElse(AccessLevel.PUBLIC);
    }

    private List<ResearchAuthor> authors(JsonNode item) {
        List<ResearchAuthor> authors = new ArrayList<>();
        for (JsonNode value : item.path("metadata").path("crr.contributor.researcher")) {
            String text = value.path("value").asText("").trim();
            if (text.isEmpty()) {
                continue;
            }
            try {
                JsonNode researcher = OBJECT_MAPPER.readTree(text);
                String name = researcher.path("name").asText("");
                if (name.isBlank()) {
                    continue;
                }
                ResearchAuthor author = new ResearchAuthor(name);
                String orcid = researcher.path("orcid").asText("");
                if (!orcid.isBlank()) {
                    author.setOrcid(orcid);
                }
                authors.add(author);
            } catch (Exception exception) {
                LOGGER.warn("Ignoring unparseable researcher value on {}.", identifier(item));
            }
        }
        return List.copyOf(authors);
    }

    /**
     * The stable identifier the rest of the system uses, which is the source identifier the sync
     * adapters assign. Items that have not been through sync fall back to the DSpace UUID so they
     * are still addressable rather than invisible.
     */
    public String identifier(JsonNode item) {
        return firstValue(item, "crr.identifier.source")
                .or(() -> firstValue(item, "dc.identifier.other"))
                .orElseGet(() -> item.path("uuid").asText());
    }

    private String title(JsonNode item) {
        return firstValue(item, "dc.title").orElseGet(() -> item.path("name").asText());
    }

    /**
     * Program comes from the project's own {@code crr.program} field. An item without one is not
     * forced into a Census program: it is reported as OTHER rather than guessed at.
     */
    private ResearchProgram program(JsonNode item) {
        return firstValue(item, "crr.program")
                .map((value) -> value.trim().toUpperCase(Locale.ROOT).replace('-', '_').replace(' ', '_'))
                .flatMap(RepositoryObjectMapper::parseProgram)
                .orElse(ResearchProgram.OTHER);
    }

    private static Optional<ResearchProgram> parseProgram(String value) {
        for (ResearchProgram program : ResearchProgram.values()) {
            if (program.getValue().equals(value)) {
                return Optional.of(program);
            }
        }
        return Optional.empty();
    }

    private String sourceUrl(JsonNode item) {
        return firstValue(item, "crr.source.url")
                .or(() -> firstValue(item, "dc.identifier.uri"))
                .or(() -> firstValue(item, "crr.documentation.url"))
                .orElse("");
    }

    private Optional<Integer> vintageYear(JsonNode item) {
        return firstValue(item, "crr.vintage")
                .or(() -> firstValue(item, "dc.date.issued").map((value) -> value.substring(0, Math.min(4, value.length()))))
                .flatMap(RepositoryObjectMapper::parseYear);
    }

    private static Optional<Integer> parseYear(String value) {
        try {
            return Optional.of(Integer.parseInt(value.trim()));
        } catch (NumberFormatException exception) {
            return Optional.empty();
        }
    }

    private Optional<LocalDate> releasedOn(JsonNode item) {
        return firstValue(item, "dc.date.issued").flatMap(RepositoryObjectMapper::parseDate);
    }

    private static Optional<LocalDate> parseDate(String value) {
        String trimmed = value.trim();
        try {
            if (trimmed.length() == 4) {
                return Optional.of(LocalDate.of(Integer.parseInt(trimmed), 1, 1));
            }
            if (trimmed.length() == 7) {
                return Optional.of(LocalDate.parse(trimmed + "-01"));
            }
            return Optional.of(LocalDate.parse(trimmed.substring(0, Math.min(10, trimmed.length()))));
        } catch (DateTimeParseException | NumberFormatException exception) {
            return Optional.empty();
        }
    }

    /**
     * The file manifest, preferring the structured {@code crr.file.manifest} entries synchronization
     * writes and falling back to the item's source and documentation URLs.
     *
     * <p>Bitstreams are deliberately not mirrored for public datasets, so the repository object
     * carries links rather than copies. The fallback keeps items that predate the manifest field —
     * or that were seeded without one — from showing an empty file list.
     */
    private List<DatasetFile> files(JsonNode item) {
        List<DatasetFile> manifestFiles = manifestFiles(item);
        if (!manifestFiles.isEmpty()) {
            return manifestFiles;
        }

        // The fallback below turns an item's landing-page URLs into file entries so that a
        // sparsely described dataset is still usable. For a restricted object that is actively
        // misleading: it has no files by definition, and listing two would offer downloads for
        // records that cannot be released.
        if (accessLevel(item) != AccessLevel.PUBLIC) {
            return List.of();
        }

        List<DatasetFile> files = new ArrayList<>();

        firstValue(item, "crr.source.url")
                .or(() -> firstValue(item, "dc.identifier.uri"))
                .ifPresent((url) -> files.add(new DatasetFile(
                        "source-manifest", "Source file manifest", formatFor(url), URI.create(url))));

        firstValue(item, "crr.documentation.url")
                .or(() -> firstValue(item, "dc.relation.uri"))
                .ifPresent((url) ->
                        files.add(new DatasetFile("documentation", "Technical documentation", formatFor(url), URI.create(url))));

        return List.copyOf(files);
    }

    private List<DatasetFile> manifestFiles(JsonNode item) {
        List<DatasetFile> files = new ArrayList<>();

        for (JsonNode value : item.path("metadata").path(DspaceFileManifest.FIELD)) {
            DspaceFileManifest.decode(value.path("value").asText(""))
                    .ifPresent((entry) -> files.add(new DatasetFile(
                            entry.id(),
                            entry.name(),
                            entry.format(),
                            URI.create(entry.sourceUrl()))
                        .sizeBytes(entry.sizeBytes())));
        }

        return List.copyOf(files);
    }

    private FileFormat formatFor(String url) {
        String normalized = url.toLowerCase(Locale.ROOT);
        if (normalized.endsWith(".zip")) {
            return FileFormat.ZIP;
        }
        if (normalized.endsWith(".csv")) {
            return FileFormat.CSV;
        }
        if (normalized.endsWith(".pdf")) {
            return FileFormat.PDF;
        }
        if (normalized.contains("geojson")) {
            return FileFormat.GEOJSON;
        }
        return FileFormat.OTHER;
    }

    private List<String> allValues(JsonNode item, String field) {
        List<String> values = new ArrayList<>();
        for (JsonNode value : item.path("metadata").path(field)) {
            String text = value.path("value").asText("").trim();
            if (!text.isEmpty()) {
                values.add(text);
            }
        }
        return List.copyOf(values);
    }

    private Optional<String> firstValue(JsonNode item, String field) {
        for (JsonNode value : item.path("metadata").path(field)) {
            String text = value.path("value").asText("").trim();
            if (!text.isEmpty()) {
                return Optional.of(text);
            }
        }
        return Optional.empty();
    }
}
