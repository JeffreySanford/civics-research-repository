package org.civicsrepo.repository;

import org.civicsrepo.generated.dto.SearchResult;
import com.fasterxml.jackson.databind.JsonNode;
import java.time.Duration;
import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicReference;
import org.civicsrepo.datasets.DatasetDetail;
import org.civicsrepo.dspace.DspaceRestClient;
import org.civicsrepo.dspace.DspaceUnavailableException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * Reads research objects out of DSpace.
 *
 * <p>The read half of "DSpace is the system of record". Everything here returns empty rather than
 * throwing when DSpace is unreachable, because the callers have a labelled fixture fallback: a
 * degraded search page is better than an error page, provided the degradation is disclosed.
 */
@Component
public class RepositoryCatalog {
    private static final Logger LOGGER = LoggerFactory.getLogger(RepositoryCatalog.class);
    private static final int MAX_RELATED_RESEARCH = 4;

    private final DspaceRestClient dspaceRestClient;
    private final RepositoryObjectMapper repositoryObjectMapper;
    private final int maxItems;
    private final Duration cacheTtl;
    private final AtomicReference<CachedItems> cache = new AtomicReference<>(null);

    public RepositoryCatalog(
            DspaceRestClient dspaceRestClient,
            RepositoryObjectMapper repositoryObjectMapper,
            @Value("${civics.repository.max-items:500}") int maxItems,
            @Value("${civics.repository.cache-ttl-seconds:60}") long cacheTtlSeconds) {
        this.dspaceRestClient = dspaceRestClient;
        this.repositoryObjectMapper = repositoryObjectMapper;
        this.maxItems = maxItems;
        this.cacheTtl = Duration.ofSeconds(cacheTtlSeconds);
    }

    /**
     * Drops the cached item list.
     *
     * <p>Called after a projection rebuild so a freshly synchronized item is visible immediately
     * rather than after the TTL expires.
     */
    public void invalidate() {
        cache.set(null);
    }

    public boolean isAvailable() {
        return dspaceRestClient.isReadEnabled();
    }

    /** Every repository item as a search result, or empty when DSpace cannot be read. */
    public List<SearchResult> findAllResearchObjects() {
        return readItems().stream()
                .map(repositoryObjectMapper::toSearchResult)
                .sorted(Comparator.comparing(SearchResult::getTitle))
                .toList();
    }

    public Optional<DatasetDetail> findDataset(String datasetId) {
        List<JsonNode> items = readItems();

        Optional<JsonNode> match = items.stream()
                .filter((item) -> repositoryObjectMapper.identifier(item).equalsIgnoreCase(datasetId))
                .findFirst();
        if (match.isEmpty()) {
            return Optional.empty();
        }

        SearchResult self = repositoryObjectMapper.toSearchResult(match.orElseThrow());
        return Optional.of(repositoryObjectMapper.toDatasetDetail(match.orElseThrow(), relatedResearch(items, self)));
    }

    /**
     * Related research computed from the repository rather than hard-coded.
     *
     * <p>Same geography first, because "other datasets about this place" is the relationship a
     * researcher is actually looking for. Same-program items are used only when the geography
     * yields nothing, which is the national case. Program alone is deliberately not enough: with
     * 52 areas per program it produced alphabetical filler — a Texas dataset "related" to Alabama
     * and Alaska — which is worse than showing fewer results.
     */
    private List<SearchResult> relatedResearch(List<JsonNode> items, SearchResult self) {
        List<SearchResult> others = items.stream()
                .map(repositoryObjectMapper::toSearchResult)
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

    private boolean sharesGeography(SearchResult candidate, SearchResult self) {
        return candidate.getGeography() != null
                && self.getGeography() != null
                && candidate.getGeography().equalsIgnoreCase(self.getGeography());
    }

    /**
     * Reads every repository item, briefly cached.
     *
     * <p>Dataset detail needs the whole set to compute related research, so without a cache each
     * page view paged through all of DSpace discovery — around a second per request at 159 items.
     * The window is deliberately short and is dropped outright on reindex, so the staleness is
     * bounded and never survives a synchronization.
     */
    private List<JsonNode> readItems() {
        if (!isAvailable()) {
            return List.of();
        }

        CachedItems cached = cache.get();
        if (cached != null && !cached.isExpired(cacheTtl)) {
            return cached.items();
        }

        try {
            List<JsonNode> items = dspaceRestClient.listAllItems(maxItems);
            cache.set(new CachedItems(items, Instant.now()));
            return items;
        } catch (DspaceUnavailableException exception) {
            LOGGER.warn("Repository read failed; callers fall back to fixtures: {}", exception.getMessage());
            return List.of();
        }
    }

    private record CachedItems(List<JsonNode> items, Instant readAt) {
        boolean isExpired(Duration ttl) {
            return Instant.now().isAfter(readAt.plus(ttl));
        }
    }
}
