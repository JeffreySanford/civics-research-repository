package org.civicsrepo.search;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import org.civicsrepo.generated.dto.RepositorySource;
import org.civicsrepo.generated.dto.SearchResponse;
import org.civicsrepo.repository.DiscoveryProjectionService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

class SearchCursorServiceTest {
    private static final String PROJECTION_ID = "a".repeat(64);
    private static final String OTHER_PROJECTION_ID = "b".repeat(64);

    @Mock
    private DiscoveryIndex discoveryIndex;

    @Mock
    private DiscoveryProjectionService projectionService;

    private SearchCursorCodec codec;
    private SearchCursorService service;

    @BeforeEach
    void setUp() {
        MockitoAnnotations.openMocks(this);
        codec = new SearchCursorCodec(new ObjectMapper(), "cursor-service-test-secret-32-bytes");
        service = new SearchCursorService(discoveryIndex, projectionService, codec);
        given(projectionService.currentProjectionId()).willReturn(PROJECTION_ID);
        given(projectionService.currentSource()).willReturn(RepositorySource.REPOSITORY);
        given(discoveryIndex.isEnabled()).willReturn(true);
    }

    @Test
    void firstPageSignsTheNextBackendPositionForTheFollowingLogicalPage() {
        given(discoveryIndex.searchWithContinuation(any(), isNull()))
                .willReturn(new SearchContinuationExecution(response(0), 4L, "next-solr-mark"));

        SearchCursorPage page = service.search(
                "climate", List.of("Office of Science"), null, null, null, null, null, null, 25);

        assertThat(page.search().getResultSource()).isEqualTo(RepositorySource.REPOSITORY);
        assertThat(page.nextCursor()).isNotBlank();

        SearchComparisonCriteria fingerprintCriteria = criteria(0, 25);
        SearchCursorState decoded = codec.decodeAndValidate(
                page.nextCursor(),
                PROJECTION_ID,
                codec.criteriaFingerprint(fingerprintCriteria),
                SearchCursorService.BACKEND);
        assertThat(decoded.page()).isEqualTo(1);
        assertThat(decoded.position()).isEqualTo("next-solr-mark");

        ArgumentCaptor<SearchComparisonCriteria> criteria = ArgumentCaptor.forClass(SearchComparisonCriteria.class);
        verify(discoveryIndex).searchWithContinuation(criteria.capture(), isNull());
        assertThat(criteria.getValue().page()).isZero();
        assertThat(criteria.getValue().pageSize()).isEqualTo(25);
    }

    @Test
    void continuationUsesTheSignedLogicalPageAndBackendPosition() {
        SearchComparisonCriteria fingerprintCriteria = criteria(0, 25);
        String cursor = codec.encode(
                PROJECTION_ID,
                codec.criteriaFingerprint(fingerprintCriteria),
                SearchCursorService.BACKEND,
                7,
                "solr-mark-7");
        given(discoveryIndex.searchWithContinuation(any(), any()))
                .willReturn(new SearchContinuationExecution(response(7), 3L, null));

        SearchCursorPage page = service.search(
                "climate", List.of("Office of Science"), null, null, null, null, null, cursor, 25);

        assertThat(page.search().getPage()).isEqualTo(7);
        assertThat(page.nextCursor()).isNull();

        ArgumentCaptor<SearchComparisonCriteria> criteria = ArgumentCaptor.forClass(SearchComparisonCriteria.class);
        verify(discoveryIndex).searchWithContinuation(criteria.capture(), org.mockito.ArgumentMatchers.eq("solr-mark-7"));
        assertThat(criteria.getValue().page()).isEqualTo(7);
    }

    @Test
    void rejectsAValidlySignedCursorAfterProjectionIdentityChanges() {
        SearchComparisonCriteria fingerprintCriteria = criteria(0, 25);
        String cursor = codec.encode(
                PROJECTION_ID,
                codec.criteriaFingerprint(fingerprintCriteria),
                SearchCursorService.BACKEND,
                1,
                "old-mark");
        given(projectionService.currentProjectionId()).willReturn(OTHER_PROJECTION_ID);

        assertThatThrownBy(() -> service.search(
                        "climate",
                        List.of("Office of Science"),
                        null,
                        null,
                        null,
                        null,
                        null,
                        cursor,
                        25))
                .isInstanceOf(SearchCursorException.class)
                .hasMessageContaining("projection changed");

        verify(discoveryIndex, never()).searchWithContinuation(any(), any());
    }

    @Test
    void rejectsAChangedPageSizeBeforeCallingTheBackend() {
        SearchComparisonCriteria fingerprintCriteria = criteria(0, 25);
        String cursor = codec.encode(
                PROJECTION_ID,
                codec.criteriaFingerprint(fingerprintCriteria),
                SearchCursorService.BACKEND,
                1,
                "old-mark");

        assertThatThrownBy(() -> service.search(
                        "climate",
                        List.of("Office of Science"),
                        null,
                        null,
                        null,
                        null,
                        null,
                        cursor,
                        50))
                .isInstanceOf(SearchCursorException.class)
                .hasMessageContaining("search criteria");

        verify(discoveryIndex, never()).searchWithContinuation(any(), any());
    }

    @Test
    void requiresAnActiveProjectionIdentityInsteadOfFallingBackToOffsets() {
        given(projectionService.currentProjectionId()).willReturn(null);

        assertThatThrownBy(() -> service.search(
                        "climate", List.of(), null, null, null, null, null, null, 25))
                .isInstanceOfSatisfying(ResponseStatusException.class, exception -> {
                    assertThat(exception.getStatusCode().value())
                            .isEqualTo(HttpStatus.SERVICE_UNAVAILABLE.value());
                    assertThat(exception.getReason()).contains("active discovery projection");
                });

        verify(discoveryIndex, never()).searchWithContinuation(any(), any());
    }

    @Test
    void backendFailureIsServiceUnavailableAndNeverFallsBack() {
        given(discoveryIndex.searchWithContinuation(any(), isNull()))
                .willThrow(new IllegalStateException("Solr unavailable"));

        assertThatThrownBy(() -> service.search(
                        "climate", List.of(), null, null, null, null, null, null, 25))
                .isInstanceOfSatisfying(ResponseStatusException.class, exception -> {
                    assertThat(exception.getStatusCode().value())
                            .isEqualTo(HttpStatus.SERVICE_UNAVAILABLE.value());
                    assertThat(exception.getReason()).contains("could not continue");
                });
    }

    private SearchComparisonCriteria criteria(int page, int pageSize) {
        return new SearchComparisonCriteria(
                "climate",
                List.of("Office of Science"),
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                page,
                pageSize);
    }

    private SearchResponse response(int page) {
        return new SearchResponse(
                RepositorySource.FIXTURE,
                "climate",
                page,
                25,
                100,
                List.of(),
                List.of());
    }
}
