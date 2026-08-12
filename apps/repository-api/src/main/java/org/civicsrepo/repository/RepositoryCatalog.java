package org.civicsrepo.repository;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import org.civicsrepo.datasets.DatasetDetail;
import org.civicsrepo.dspace.DspaceRestClient;
import org.civicsrepo.dspace.DspaceUnavailableException;
import org.civicsrepo.search.SearchResult;
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

    public RepositoryCatalog(
            DspaceRestClient dspaceRestClient,
            RepositoryObjectMapper repositoryObjectMapper,
            @Value("${civics.repository.max-items:500}") int maxItems) {
        this.dspaceRestClient = dspaceRestClient;
        this.repositoryObjectMapper = repositoryObjectMapper;
        this.maxItems = maxItems;
    }

    public boolean isAvailable() {
        return dspaceRestClient.isReadEnabled();
    }

    /** Every repository item as a search result, or empty when DSpace cannot be read. */
    public List<SearchResult> findAllResearchObjects() {
        return readItems().stream()
                .map(repositoryObjectMapper::toSearchResult)
                .sorted(Comparator.comparing(SearchResult::title))
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
     * Related research is computed from the repository itself rather than hard-coded: other items
     * sharing this item's geography first, then its program.
     */
    private List<SearchResult> relatedResearch(List<JsonNode> items, SearchResult self) {
        List<SearchResult> others = items.stream()
                .map(repositoryObjectMapper::toSearchResult)
                .filter((result) -> !result.id().equals(self.id()))
                .toList();

        return others.stream()
                .sorted(Comparator.comparing((SearchResult result) -> relevance(result, self))
                        .reversed()
                        .thenComparing(SearchResult::title))
                .filter((result) -> relevance(result, self) > 0)
                .limit(MAX_RELATED_RESEARCH)
                .toList();
    }

    private int relevance(SearchResult candidate, SearchResult self) {
        int score = 0;
        if (candidate.geography() != null && candidate.geography().equalsIgnoreCase(self.geography())) {
            score += 2;
        }
        if (candidate.program() == self.program()) {
            score += 1;
        }
        return score;
    }

    private List<JsonNode> readItems() {
        if (!isAvailable()) {
            return List.of();
        }

        try {
            return dspaceRestClient.listAllItems(maxItems);
        } catch (DspaceUnavailableException exception) {
            LOGGER.warn("Repository read failed; callers fall back to fixtures: {}", exception.getMessage());
            return List.of();
        }
    }
}
