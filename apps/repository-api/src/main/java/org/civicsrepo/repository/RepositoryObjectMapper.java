package org.civicsrepo.repository;

import org.civicsrepo.generated.dto.RepositorySource;
import com.fasterxml.jackson.databind.JsonNode;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import org.civicsrepo.datasets.DatasetDetail;
import org.civicsrepo.datasets.DatasetFile;
import org.civicsrepo.datasets.EvidenceStatus;
import org.civicsrepo.datasets.FileFormat;
import org.civicsrepo.dspace.DspaceFileManifest;
import org.civicsrepo.search.ResearchObjectType;
import org.civicsrepo.search.ResearchProgram;
import org.civicsrepo.search.SearchResult;
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
    private static final String PUBLISHER_FALLBACK = "U.S. Census Bureau";

    public SearchResult toSearchResult(JsonNode item) {
        String geography = firstValue(item, "dc.coverage.spatial").orElse("United States");

        return new SearchResult(
                identifier(item),
                title(item),
                ResearchObjectType.DATASET,
                program(item),
                firstValue(item, "dc.publisher").orElse(PUBLISHER_FALLBACK),
                firstValue(item, "dc.description.abstract").orElse(""),
                geography,
                vintageYear(item).orElse(null),
                sourceUrl(item));
    }

    public DatasetDetail toDatasetDetail(JsonNode item, List<SearchResult> relatedResearch) {
        return new DatasetDetail(
                RepositorySource.REPOSITORY,
                identifier(item),
                title(item),
                program(item),
                firstValue(item, "dc.publisher").orElse(PUBLISHER_FALLBACK),
                firstValue(item, "dc.description.abstract").orElse(""),
                firstValue(item, "dc.coverage.spatial").orElse("United States"),
                vintageYear(item).orElse(null),
                releasedOn(item).orElse(null),
                files(item),
                firstValue(item, "dc.identifier.citation").orElse(title(item)),
                sourceUrl(item),
                EvidenceStatus.AUTOMATED_PASS,
                relatedResearch);
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
            if (program.name().equals(value)) {
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

        List<DatasetFile> files = new ArrayList<>();

        firstValue(item, "crr.source.url")
                .or(() -> firstValue(item, "dc.identifier.uri"))
                .ifPresent((url) -> files.add(new DatasetFile(
                        "source-manifest", "Source file manifest", formatFor(url), url, null)));

        firstValue(item, "crr.documentation.url")
                .or(() -> firstValue(item, "dc.relation.uri"))
                .ifPresent((url) ->
                        files.add(new DatasetFile("documentation", "Technical documentation", formatFor(url), url, null)));

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
                            entry.sourceUrl(),
                            entry.sizeBytes())));
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
