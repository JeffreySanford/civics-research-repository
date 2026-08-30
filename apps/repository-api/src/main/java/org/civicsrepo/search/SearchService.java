package org.civicsrepo.search;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.civicsrepo.generated.dto.FacetGroup;
import org.civicsrepo.generated.dto.FacetValue;
import org.civicsrepo.generated.dto.RepositorySource;
import org.civicsrepo.generated.dto.ResearchObjectType;
import org.civicsrepo.generated.dto.SearchResponse;
import org.civicsrepo.generated.dto.SearchResult;
import org.civicsrepo.repository.FixtureCatalog;
import org.civicsrepo.repository.RepositoryCatalog;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

@Service
public class SearchService {
    private static final Logger LOGGER = LoggerFactory.getLogger(SearchService.class);
    private final DiscoveryIndex discoveryIndex;
    private final RepositoryCatalog repositoryCatalog;
    private final FixtureCatalog fixtureCatalog;

    public SearchService() {
        this(null, null, new FixtureCatalog());
    }

    @Autowired
    public SearchService(
            DiscoveryIndex discoveryIndex, RepositoryCatalog repositoryCatalog, FixtureCatalog fixtureCatalog) {
        this.discoveryIndex = discoveryIndex;
        this.repositoryCatalog = repositoryCatalog;
        this.fixtureCatalog = fixtureCatalog;
    }

    /**
     * The generated placeholder catalog.
     *
     * <p>A fallback for demo recovery when the repository is not available. Every response built
     * from it is labelled {@link RepositorySource#FIXTURE}. It is generated from the same catalog
     * that seeds DSpace, so the two describe the same objects rather than drifting apart.
     */
    public List<SearchResult> fixtureResults() {
        return fixtureCatalog.searchResults();
    }

    /** The fixture catalog as discovery documents, for the projection to index when DSpace is empty. */
    public List<DiscoveryDocument> fixtureDocuments() {
        return fixtureCatalog.discoveryDocuments();
    }

    public SearchResponse search(
            String query,
            List<String> programs,
            String geography,
            ResearchObjectType contentType,
            Integer vintageYear,
            int page,
            int pageSize) {
        if (discoveryIndex != null && discoveryIndex.isEnabled()) {
            try {
                return discoveryIndex
                        .search(query, programs, geography, contentType, vintageYear, page, pageSize)
                        .resultSource(indexedSource());
            } catch (RuntimeException exception) {
                LOGGER.warn("Solr search failed; answering from in-memory results.", exception);
            }
        }

        List<SearchResult> repositoryObjects =
                repositoryCatalog == null ? List.of() : repositoryCatalog.findAllResearchObjects();
        if (!repositoryObjects.isEmpty()) {
            return searchInMemory(
                    repositoryObjects,
                    RepositorySource.REPOSITORY,
                    query,
                    programs,
                    geography,
                    contentType,
                    vintageYear,
                    page,
                    pageSize);
        }

        return searchInMemory(
                fixtureCatalog.searchResults(),
                RepositorySource.FIXTURE,
                query,
                programs,
                geography,
                contentType,
                vintageYear,
                page,
                pageSize);
    }

    private RepositorySource indexedSource() {
        boolean repositoryBacked = repositoryCatalog != null && !repositoryCatalog.findAllResearchObjects().isEmpty();
        return repositoryBacked ? RepositorySource.REPOSITORY : RepositorySource.FIXTURE;
    }

    private SearchResponse searchInMemory(
            List<SearchResult> catalog,
            RepositorySource resultSource,
            String query,
            List<String> programs,
            String geography,
            ResearchObjectType contentType,
            Integer vintageYear,
            int page,
            int pageSize) {
        String normalizedQuery = normalize(query);
        String normalizedGeography = normalize(geography);
        Set<String> selectedPrograms = normalizeValues(programs);

        List<SearchResult> filtered = catalog.stream()
                .filter((result) -> matchesQuery(result, normalizedQuery))
                .filter((result) -> selectedPrograms.isEmpty()
                        || selectedPrograms.contains(normalize(programName(result))))
                .filter((result) ->
                        normalizedGeography.isBlank() || normalize(result.getGeography()).contains(normalizedGeography))
                .filter((result) -> vintageYear == null || vintageYear.equals(result.getVintageYear()))
                .filter((result) -> contentType == null || contentType == typeOf(result))
                .sorted(Comparator.comparing(SearchResult::getTitle))
                .toList();

        int safePage = Math.max(0, page);
        int safePageSize = Math.max(1, Math.min(pageSize, 100));
        int fromIndex = Math.min(safePage * safePageSize, filtered.size());
        int toIndex = Math.min(fromIndex + safePageSize, filtered.size());

        return new SearchResponse(
                resultSource,
                query == null ? "" : query,
                safePage,
                safePageSize,
                filtered.size(),
                filtered.subList(fromIndex, toIndex),
                List.of(
                        facetGroup(
                                "program",
                                "Program",
                                catalog.stream()
                                        .filter((result) -> matchesQuery(result, normalizedQuery))
                                        .filter((result) -> normalizedGeography.isBlank()
                                                || normalize(result.getGeography()).contains(normalizedGeography))
                                        .filter((result) ->
                                                vintageYear == null || vintageYear.equals(result.getVintageYear()))
                                        .filter((result) -> contentType == null || contentType == typeOf(result))
                                        .toList(),
                                this::programName,
                                selectedPrograms),
                        facetGroup(
                                "geography",
                                "Geography",
                                filtered,
                                SearchResult::getGeography,
                                geography == null ? "" : geography),
                        facetGroup(
                                "type",
                                "Type",
                                filtered,
                                (result) -> typeOf(result).getValue(),
                                contentType == null ? "" : contentType.getValue()),
                        descending(facetGroup(
                                "vintageYear",
                                "Year",
                                catalog.stream()
                                        .filter((result) -> matchesQuery(result, normalizedQuery))
                                        .filter((result) -> selectedPrograms.isEmpty()
                                                || selectedPrograms.contains(normalize(programName(result))))
                                        .filter((result) -> normalizedGeography.isBlank()
                                                || normalize(result.getGeography()).contains(normalizedGeography))
                                        .filter((result) -> contentType == null || contentType == typeOf(result))
                                        .filter((result) -> result.getVintageYear() != null)
                                        .toList(),
                                (result) -> String.valueOf(result.getVintageYear()),
                                vintageYear == null ? "" : String.valueOf(vintageYear)))));
    }

    private ResearchObjectType typeOf(SearchResult result) {
        return result.getContentType() == null ? ResearchObjectType.DATASET : result.getContentType();
    }

    /** Returns the canonical data-driven program name with legacy enum fallback. */
    private String programName(SearchResult result) {
        if (result.getProgramName() != null && !result.getProgramName().isBlank()) {
            return result.getProgramName().trim();
        }
        return result.getProgram() == null ? "OTHER" : result.getProgram().getValue();
    }

    private boolean matchesQuery(SearchResult result, String normalizedQuery) {
        if (normalizedQuery.isBlank()) {
            return true;
        }

        String haystack = String.join(
                " ",
                normalize(result.getTitle()),
                normalize(result.getSummary()),
                normalize(result.getPublisher()),
                normalize(result.getGeography()),
                normalize(programName(result)));

        List<String> terms =
                Arrays.stream(normalizedQuery.split("\\s+")).filter((term) -> !term.isBlank()).toList();
        if (terms.isEmpty()) {
            return true;
        }

        long matched = terms.stream().filter(haystack::contains).count();
        long required = terms.size() <= 2 ? terms.size() : (long) Math.ceil(terms.size() * 2.0 / 3.0);
        return matched >= required;
    }

    private FacetGroup facetGroup(
            String field,
            String label,
            List<SearchResult> results,
            Function<SearchResult, String> valueSelector,
            String selectedValue) {
        return facetGroup(
                field,
                label,
                results,
                valueSelector,
                normalize(selectedValue).isBlank() ? Set.of() : Set.of(normalize(selectedValue)));
    }

    private FacetGroup descending(FacetGroup group) {
        List<FacetValue> reversed = new ArrayList<>(group.getValues());
        Collections.reverse(reversed);
        return new FacetGroup(group.getField(), group.getLabel(), reversed);
    }

    private FacetGroup facetGroup(
            String field,
            String label,
            List<SearchResult> results,
            Function<SearchResult, String> valueSelector,
            Set<String> normalizedSelected) {
        Map<String, Long> counts = results.stream()
                .collect(Collectors.groupingBy(valueSelector, Collectors.counting()));

        List<FacetValue> values = counts.entrySet().stream()
                .sorted(Map.Entry.comparingByKey())
                .map((entry) -> new FacetValue(
                        entry.getKey(),
                        entry.getKey().replace('_', ' '),
                        Math.toIntExact(entry.getValue()),
                        normalizedSelected.contains(normalize(entry.getKey()))))
                .toList();

        return new FacetGroup(field, label, values);
    }

    private Set<String> normalizeValues(List<String> values) {
        if (values == null || values.isEmpty()) {
            return Set.of();
        }
        return values.stream()
                .map(this::normalize)
                .filter((value) -> !value.isBlank())
                .collect(Collectors.toSet());
    }

    private String normalize(String value) {
        return value == null ? "" : value.trim().toLowerCase(Locale.ROOT);
    }
}
