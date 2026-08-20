package org.civicsrepo.search;

import java.net.URI;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Arrays;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import org.civicsrepo.repository.FixtureCatalog;
import org.civicsrepo.repository.RepositoryCatalog;
import org.civicsrepo.generated.dto.FacetGroup;
import org.civicsrepo.generated.dto.FacetValue;
import org.civicsrepo.generated.dto.ResearchObjectType;
import org.civicsrepo.generated.dto.ResearchProgram;
import org.civicsrepo.generated.dto.SearchResponse;
import org.civicsrepo.generated.dto.SearchResult;
import org.civicsrepo.generated.dto.RepositorySource;
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
            List<ResearchProgram> programs,
            String geography,
            ResearchObjectType contentType,
            Integer vintageYear,
            int page,
            int pageSize) {
        // Solr holds the projection built by DiscoveryProjectionService, so it is the fast path for
        // both repository-backed and fixture-backed content. Its source label comes from what was
        // last projected, not from the query.
        if (discoveryIndex != null && discoveryIndex.isEnabled()) {
            try {
                return discoveryIndex
                        .search(query, programs, geography, contentType, vintageYear, page, pageSize)
                        // The generated model is mutable, and this response was just built by the
                        // client for this call, so relabelling it in place is safe.
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

    /**
     * Whether the Solr projection currently holds repository content.
     *
     * <p>Derived by asking the repository rather than by trusting the index, so a stale index
     * cannot cause fixture content to be labelled as repository content.
     */
    private RepositorySource indexedSource() {
        boolean repositoryBacked = repositoryCatalog != null && !repositoryCatalog.findAllResearchObjects().isEmpty();
        return repositoryBacked ? RepositorySource.REPOSITORY : RepositorySource.FIXTURE;
    }

    private SearchResponse searchInMemory(
            List<SearchResult> catalog,
            RepositorySource resultSource,
            String query,
            List<ResearchProgram> programs,
            String geography,
            ResearchObjectType contentType,
            Integer vintageYear,
            int page,
            int pageSize) {
        String normalizedQuery = normalize(query);
        String normalizedGeography = normalize(geography);

        List<SearchResult> filtered = catalog.stream()
                .filter((result) -> matchesQuery(result, normalizedQuery))
                .filter((result) -> programs.isEmpty() || programs.contains(result.getProgram()))
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
                                // Facet counts ignore the program filter itself, so selecting one
                                // program does not hide the others and make them unselectable.
                                catalog.stream()
                                        .filter((result) -> matchesQuery(result, normalizedQuery))
                                        .filter((result) -> normalizedGeography.isBlank()
                                                || normalize(result.getGeography()).contains(normalizedGeography))
                                        .filter((result) ->
                                                vintageYear == null || vintageYear.equals(result.getVintageYear()))
                                        .toList(),
                                (result) -> result.getProgram().getValue(),
                                programs),
                        facetGroup("geography", "Geography", filtered, SearchResult::getGeography, geography == null ? "" : geography),
                        // Type last, because it is the newest axis and the narrowest: most of the
                        // catalog is datasets, so leading with it would show one value at 177 and
                        // three in single figures.
                        facetGroup(
                                "type",
                                "Type",
                                filtered,
                                (result) -> typeOf(result).getValue(),
                                contentType == null ? "" : contentType.getValue()),
                        // Counted before the vintage filter is applied, like every other facet, so
                        // selecting a year does not hide the others and make the choice a one-way door.
                        descending(facetGroup(
                                "vintageYear",
                                "Year",
                                catalog.stream()
                                        .filter((result) -> matchesQuery(result, normalizedQuery))
                                        .filter((result) -> programs.isEmpty()
                                                || programs.contains(result.getProgram()))
                                        .filter((result) -> normalizedGeography.isBlank()
                                                || normalize(result.getGeography()).contains(normalizedGeography))
                                        .filter((result) -> contentType == null || contentType == typeOf(result))
                                        .filter((result) -> result.getVintageYear() != null)
                                        .toList(),
                                (result) -> String.valueOf(result.getVintageYear()),
                                vintageYear == null ? "" : String.valueOf(vintageYear)))));
    }

    /** Untyped results are datasets, which is what every item seeded before packages existed is. */
    private ResearchObjectType typeOf(SearchResult result) {
        return result.getContentType() == null ? ResearchObjectType.DATASET : result.getContentType();
    }

    /**
     * Tokenized matching, so losing Solr changes the ranking rather than the result set.
     *
     * <p>This used to require the whole normalized query as a single substring, which meant Solr
     * and the fallback disagreed about what a search even means: Solr returned Census objects for
     * "North Dakota workforce" while the fallback returned nothing, because no title contains that
     * phrase verbatim. A demo that falls back to a different search is a demo with two behaviours.
     *
     * <p>Two thirds of the terms must appear somewhere in the object's text, which is the rule the
     * Solr query uses (mm=2&lt;67%). The fallback still cannot see subjects, authors or citations:
     * those are indexed for Solr and are not carried on {@code SearchResult}.
     */
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
                normalize(result.getProgram().getValue()));

        List<String> terms =
                Arrays.stream(normalizedQuery.split("\s+")).filter((term) -> !term.isBlank()).toList();
        if (terms.isEmpty()) {
            return true;
        }

        long matched = terms.stream().filter(haystack::contains).count();
        // One or two terms must all match; three or more need two thirds, rounded up.
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

    private FacetGroup facetGroup(
            String field,
            String label,
            List<SearchResult> results,
            Function<SearchResult, String> valueSelector,
            List<ResearchProgram> selectedPrograms) {
        return facetGroup(
                field,
                label,
                results,
                valueSelector,
                selectedPrograms.stream()
                        .map((program) -> normalize(program.getValue()))
                        .collect(Collectors.toSet()));
    }

    /**
     * Reverses a facet group's values.
     *
     * Facet values are grouped and sorted ascending by key, which is right for a program or a
     * geography and wrong for a year: a reader scanning vintages wants the most recent first. The
     * Solr path reverses the same group for the same reason.
     */
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
                        // The contract types counts as int32, so a long was never carried on the
                        // wire. toIntExact fails loudly rather than truncating silently.
                        Math.toIntExact(entry.getValue()),
                        normalizedSelected.contains(normalize(entry.getKey()))))
                .toList();

        return new FacetGroup(field, label, values);
    }

    private String normalize(String value) {
        return value == null ? "" : value.trim().toLowerCase(Locale.ROOT);
    }


}
