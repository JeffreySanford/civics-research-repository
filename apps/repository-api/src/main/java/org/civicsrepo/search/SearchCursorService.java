package org.civicsrepo.search;

import java.util.List;
import org.civicsrepo.generated.dto.ResearchObjectType;
import org.civicsrepo.generated.dto.SearchResponse;
import org.civicsrepo.generated.dto.SourceSystem;
import org.civicsrepo.repository.DiscoveryProjectionService;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

/**
 * Public deep-discovery traversal bound to the active deterministic Solr projection.
 *
 * <p>This service deliberately has no in-memory or offset fallback. A cursor is meaningful only for
 * the projection and backend that issued it; restarting against another source would create silent
 * duplicate/skip defects that the cursor contract exists to prevent.
 */
@Service
public class SearchCursorService {
    static final String BACKEND = "SOLR";

    private final DiscoveryIndex discoveryIndex;
    private final DiscoveryProjectionService projectionService;
    private final SearchCursorCodec cursorCodec;

    public SearchCursorService(
            DiscoveryIndex discoveryIndex,
            DiscoveryProjectionService projectionService,
            SearchCursorCodec cursorCodec) {
        this.discoveryIndex = discoveryIndex;
        this.projectionService = projectionService;
        this.cursorCodec = cursorCodec;
    }

    public SearchCursorPage search(
            String query,
            List<String> programs,
            String publisher,
            SourceSystem sourceSystem,
            String geography,
            ResearchObjectType contentType,
            Integer vintageYear,
            String cursor,
            int pageSize) {
        String projectionId = activeProjectionId();
        SearchComparisonCriteria fingerprintCriteria = criteria(
                query,
                programs,
                publisher,
                sourceSystem,
                geography,
                contentType,
                vintageYear,
                0,
                pageSize);
        String criteriaFingerprint = cursorCodec.criteriaFingerprint(fingerprintCriteria);

        int page = 0;
        String continuationPosition = null;
        if (cursor != null && !cursor.isBlank()) {
            SearchCursorState state = cursorCodec.decodeAndValidate(
                    cursor, projectionId, criteriaFingerprint, BACKEND);
            page = state.page();
            continuationPosition = state.position();
        }

        SearchComparisonCriteria criteria = criteria(
                query,
                programs,
                publisher,
                sourceSystem,
                geography,
                contentType,
                vintageYear,
                page,
                fingerprintCriteria.pageSize());

        SearchContinuationExecution execution;
        try {
            if (!discoveryIndex.isEnabled()) {
                throw unavailable("Cursor search is unavailable because the public discovery index is disabled.");
            }
            execution = discoveryIndex.searchWithContinuation(criteria, continuationPosition);
        } catch (SearchCursorException exception) {
            throw exception;
        } catch (ResponseStatusException exception) {
            throw exception;
        } catch (RuntimeException exception) {
            throw unavailable("Cursor search is unavailable because the public discovery index could not continue.", exception);
        }

        SearchResponse response = execution.response().resultSource(projectionService.currentSource());
        String nextCursor = execution.nextPosition() == null
                ? null
                : cursorCodec.encode(
                        projectionId,
                        criteriaFingerprint,
                        BACKEND,
                        page + 1,
                        execution.nextPosition());
        return new SearchCursorPage(response, nextCursor);
    }

    private SearchComparisonCriteria criteria(
            String query,
            List<String> programs,
            String publisher,
            SourceSystem sourceSystem,
            String geography,
            ResearchObjectType contentType,
            Integer vintageYear,
            int page,
            int pageSize) {
        return new SearchComparisonCriteria(
                query,
                programs == null ? List.of() : programs,
                publisher,
                sourceSystem,
                null,
                null,
                geography,
                contentType,
                vintageYear,
                page,
                pageSize);
    }

    private String activeProjectionId() {
        String projectionId = projectionService.currentProjectionId();
        if (projectionId == null || projectionId.isBlank()) {
            throw unavailable("Cursor search is unavailable until an active discovery projection has an identity.");
        }
        return projectionId;
    }

    private ResponseStatusException unavailable(String message) {
        return new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, message);
    }

    private ResponseStatusException unavailable(String message, RuntimeException cause) {
        return new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, message, cause);
    }
}
