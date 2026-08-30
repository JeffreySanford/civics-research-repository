package org.civicsrepo.repository;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.io.InputStream;
import java.net.URI;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import org.civicsrepo.generated.dto.ResearchObjectDetail;
import org.civicsrepo.generated.dto.DatasetFile;
import org.civicsrepo.generated.dto.EvidenceStatus;
import org.civicsrepo.generated.dto.FileFormat;
import org.civicsrepo.generated.dto.RepositorySource;
import org.civicsrepo.generated.dto.AccessLevel;
import org.civicsrepo.generated.dto.ResearchAuthor;
import org.civicsrepo.generated.dto.ResearchObjectOrigin;
import org.civicsrepo.generated.dto.ResearchObjectType;
import org.civicsrepo.generated.dto.ResearchProgram;
import org.civicsrepo.generated.dto.SearchResult;
import org.civicsrepo.search.DiscoveryDocument;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * The catalog the API serves when DSpace holds nothing.
 *
 * <p>This was previously written by hand in Java, in two places, and it drifted from the catalog
 * actually seeded into the repository: it listed LODES for three areas the publisher does not
 * cover, linked program pages rather than the verified file-level URLs, and never gained the eight
 * programs added later. Responses were labelled {@code FIXTURE}, so nothing claimed to be
 * repository content, but a fixture that names a source URL for a file that does not exist is the
 * same problem one layer up.
 *
 * <p>It is now generated from {@code tools/dspace/catalog.json} by the same script that writes the
 * SAF packages, so the fallback and the seeded repository describe the same objects by
 * construction. {@code pnpm run fixture:check} fails if the committed file is stale.
 */
@Component
public class FixtureCatalog {
    private static final Logger LOGGER = LoggerFactory.getLogger(FixtureCatalog.class);
    private static final String RESOURCE = "/discovery-fixture-catalog.json";
    private static final int MAX_RELATED_RESEARCH = 3;

    private final List<SearchResult> searchResults;
    private final List<DiscoveryDocument> discoveryDocuments;
    private final Map<String, ResearchObjectDetail> datasetsById;

    public FixtureCatalog() {
        this(RESOURCE);
    }

    FixtureCatalog(String resource) {
        List<SearchResult> results = new ArrayList<>();
        Map<String, ResearchObjectDetail> datasets = new LinkedHashMap<>();
        Map<String, List<ResearchRelationResolver.RawEdge>> edgesById = new LinkedHashMap<>();
        List<DiscoveryDocument> documents = new ArrayList<>();

        for (JsonNode item : readItems(resource)) {
            SearchResult result = toSearchResult(item);
            results.add(result);
            datasets.put(result.getId(), toResearchObjectDetail(item, result));
            edgesById.put(result.getId(), ResearchRelationResolver.parse(item.path("relations")));
            documents.add(new DiscoveryDocument(
                    result,
                    textList(item.path("subjects")),
                    authors(item).stream().map(ResearchAuthor::getName).toList(),
                    textOrNull(item, "citation"),
                    textOrNull(item, "doi")));
        }

        this.searchResults = List.copyOf(results);
        this.discoveryDocuments = List.copyOf(documents);

        // Related research needs the whole set, so it is filled in a second pass and stored. The
        // generated models are mutable, so computing it on each read would mutate the shared
        // instance a caller is holding.
        Map<String, SearchResult> byId = new LinkedHashMap<>();
        for (SearchResult result : results) {
            byId.put(result.getId(), result);
        }

        for (ResearchObjectDetail dataset : datasets.values()) {
            dataset.setRelatedResearch(relatedResearch(dataset, results));
            dataset.setRelations(
                    ResearchRelationResolver.resolve(edgesById.get(dataset.getId()), byId));
        }
        this.datasetsById = Map.copyOf(datasets);
        LOGGER.info("Fixture catalog loaded with {} research objects.", searchResults.size());
    }

    public List<SearchResult> searchResults() {
        return searchResults;
    }

    public List<DiscoveryDocument> discoveryDocuments() {
        return discoveryDocuments;
    }

    public Optional<ResearchObjectDetail> findDataset(String datasetId) {
        return Optional.ofNullable(datasetsById.get(datasetId));
    }

    /**
     * Related research, computed the way the repository-backed path computes it: same geography
     * first, falling back to same program for national objects. Not baked into the generated file,
     * which would repeat every item's neighbours inside every item.
     */
    private List<SearchResult> relatedResearch(ResearchObjectDetail self, List<SearchResult> all) {
        List<SearchResult> others = all.stream()
                .filter((result) -> !result.getId().equals(self.getId()))
                .toList();

        List<SearchResult> sameGeography = others.stream()
                .filter((result) -> sharesGeography(result, self))
                .sorted(Comparator.comparing(SearchResult::getTitle))
                .limit(MAX_RELATED_RESEARCH)
                .toList();

        if (!sameGeography.isEmpty()) {
            return sameGeography;
        }

        return others.stream()
                .filter((result) -> result.getProgram() == self.getProgram())
                .sorted(Comparator.comparing(SearchResult::getTitle))
                .limit(MAX_RELATED_RESEARCH)
                .toList();
    }

    private boolean sharesGeography(SearchResult candidate, ResearchObjectDetail self) {
        return candidate.getGeography() != null
                && self.getGeography() != null
                && candidate.getGeography().equalsIgnoreCase(self.getGeography());
    }

    private JsonNode readItems(String resource) {
        try (InputStream stream = FixtureCatalog.class.getResourceAsStream(resource)) {
            if (stream == null) {
                throw new IllegalStateException(
                        "Fixture catalog " + resource + " is missing. Run: pnpm run dspace:saf:generate");
            }
            return new ObjectMapper().readTree(stream).path("items");
        } catch (IOException exception) {
            throw new IllegalStateException("Fixture catalog " + resource + " could not be read.", exception);
        }
    }

    private SearchResult toSearchResult(JsonNode item) {
        ResearchProgram researchProgram = program(item.path("program").asText());
        return new SearchResult(
                        item.path("id").asText(),
                        item.path("title").asText(),
                        contentType(item),
                        researchProgram,
                        item.path("publisher").asText(),
                        item.path("summary").asText(),
                        URI.create(item.path("sourceUrl").asText()),
                        ResearchObjectOrigin.FIXTURE,
                        ResearchSourceSystemClassifier.forProgram(researchProgram))
                .geography(item.path("geography").asText())
                .vintageYear(item.path("vintageYear").asInt())
                .accessLevel(accessLevel(item));
    }

    private ResearchObjectDetail toResearchObjectDetail(JsonNode item, SearchResult result) {
        return new ResearchObjectDetail(
                        RepositorySource.FIXTURE,
                        result.getId(),
                        result.getTitle(),
                        result.getProgram(),
                        result.getPublisher(),
                        result.getSummary(),
                        files(item),
                        item.path("citation").asText(),
                        result.getSourceUrl(),
                        List.of(),
                        ResearchObjectOrigin.FIXTURE,
                        result.getSourceSystem())
                .geography(result.getGeography())
                .vintageYear(result.getVintageYear())
                .releasedOn(releasedOn(item))
                .contentType(result.getContentType())
                .accessLevel(result.getAccessLevel())
                .accessNote(textOrNull(item, "accessNote"))
                .license(textOrNull(item, "license"))
                .doi(textOrNull(item, "doi"))
                .authors(authors(item))
                // The fixture path has no accessibility evidence of its own to report.
                .accessibilityEvidenceStatus(EvidenceStatus.NOT_STARTED);
    }

    /**
     * Absent, not empty. Every item seeded before research packages existed carries no type, and
     * defaulting those to DATASET is a statement of fact rather than a guess: the catalog held
     * nothing else.
     */
    private ResearchObjectType contentType(JsonNode item) {
        String value = item.path("contentType").asText("");
        if (value.isBlank()) {
            return ResearchObjectType.DATASET;
        }
        try {
            return ResearchObjectType.fromValue(value);
        } catch (IllegalArgumentException exception) {
            LOGGER.warn("Unknown research object type {}; treating it as a dataset.", value);
            return ResearchObjectType.DATASET;
        }
    }

    private AccessLevel accessLevel(JsonNode item) {
        String value = item.path("accessLevel").asText("");
        if (value.isBlank()) {
            return AccessLevel.PUBLIC;
        }
        try {
            return AccessLevel.fromValue(value);
        } catch (IllegalArgumentException exception) {
            // Never silently fall back to PUBLIC on an unreadable value: the safe default for an
            // access level is the restrictive one.
            LOGGER.warn("Unknown access level {}; treating it as restricted.", value);
            return AccessLevel.RESTRICTED;
        }
    }

    private List<ResearchAuthor> authors(JsonNode item) {
        List<ResearchAuthor> authors = new ArrayList<>();
        for (JsonNode author : item.path("authors")) {
            String name = author.path("name").asText("");
            if (name.isBlank()) {
                continue;
            }
            ResearchAuthor researcher = new ResearchAuthor(name);
            String orcid = author.path("orcid").asText("");
            if (!orcid.isBlank()) {
                researcher.setOrcid(orcid);
            }
            authors.add(researcher);
        }
        return List.copyOf(authors);
    }

    private List<String> textList(JsonNode values) {
        List<String> texts = new ArrayList<>();
        for (JsonNode value : values) {
            String text = value.asText("").trim();
            if (!text.isEmpty()) {
                texts.add(text);
            }
        }
        return List.copyOf(texts);
    }

    private String textOrNull(JsonNode item, String field) {
        String value = item.path(field).asText("");
        return value.isBlank() ? null : value;
    }

    private List<DatasetFile> files(JsonNode item) {
        List<DatasetFile> files = new ArrayList<>();
        for (JsonNode file : item.path("files")) {
            files.add(new DatasetFile(
                    file.path("id").asText(),
                    file.path("label").asText(),
                    format(file.path("format").asText()),
                    URI.create(file.path("url").asText())));
        }
        return List.copyOf(files);
    }

    /**
     * An unrecognized value is reported as OTHER rather than guessed at, matching how the
     * repository-backed mapper treats one.
     */
    private ResearchProgram program(String value) {
        try {
            return ResearchProgram.fromValue(value.toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException exception) {
            return ResearchProgram.OTHER;
        }
    }

    private FileFormat format(String value) {
        try {
            return FileFormat.fromValue(value.toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException exception) {
            return FileFormat.OTHER;
        }
    }

    private LocalDate releasedOn(JsonNode item) {
        String value = item.path("releasedOn").asText("");
        if (value.isBlank()) {
            return null;
        }

        try {
            return LocalDate.parse(value);
        } catch (DateTimeParseException exception) {
            return null;
        }
    }
}
