package org.civicsrepo.search;

import java.util.List;
import org.civicsrepo.generated.dto.ResearchObjectType;
import org.civicsrepo.generated.dto.SourceSystem;

/** One normalized, engine-neutral request used by both search-comparison adapters. */
public record SearchComparisonCriteria(
        String query,
        List<String> programs,
        String publisher,
        SourceSystem sourceSystem,
        String localId,
        String doi,
        String geography,
        ResearchObjectType contentType,
        Integer vintageYear,
        int page,
        int pageSize) {

    public SearchComparisonCriteria {
        query = query == null ? "" : query.trim();
        programs = programs == null
                ? List.of()
                : programs.stream()
                        .filter((program) -> program != null && !program.isBlank())
                        .map(String::trim)
                        .toList();
        publisher = trimToNull(publisher);
        localId = trimToNull(localId);
        doi = trimToNull(doi);
        geography = trimToNull(geography);
        page = Math.max(0, page);
        pageSize = Math.max(1, Math.min(100, pageSize));
    }

    public boolean hasComparisonOnlyFilters() {
        return publisher != null || sourceSystem != null || localId != null || doi != null;
    }

    private static String trimToNull(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return value.trim();
    }
}
