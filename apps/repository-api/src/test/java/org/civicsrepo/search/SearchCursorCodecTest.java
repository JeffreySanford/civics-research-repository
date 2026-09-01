package org.civicsrepo.search;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import org.civicsrepo.generated.dto.ResearchObjectType;
import org.civicsrepo.generated.dto.SourceSystem;
import org.junit.jupiter.api.Test;

class SearchCursorCodecTest {
    private final SearchCursorCodec codec = new SearchCursorCodec(new ObjectMapper());

    @Test
    void roundTripsOpaqueBackendPositionBoundToProjectionAndCriteria() {
        SearchComparisonCriteria criteria = criteria("climate", List.of("NASA", "ACS"), 0, 25);
        String fingerprint = codec.criteriaFingerprint(criteria);
        String token = codec.encode("a".repeat(64), fingerprint, "SOLR", 3, "AoE_123==");

        SearchCursorState state =
                codec.decodeAndValidate(token, "a".repeat(64), fingerprint, "SOLR");

        assertThat(token).startsWith("v1.");
        assertThat(token).doesNotContain("AoE_123");
        assertThat(state.position()).isEqualTo("AoE_123==");
        assertThat(state.page()).isEqualTo(3);
        assertThat(state.projectionId()).isEqualTo("a".repeat(64));
        assertThat(state.criteriaFingerprint()).isEqualTo(fingerprint);
        assertThat(state.backend()).isEqualTo("SOLR");
    }

    @Test
    void criteriaFingerprintIgnoresOffsetPageButIncludesPageSizeAndSearchSemantics() {
        String firstPage = codec.criteriaFingerprint(criteria("climate", List.of("ACS", "NASA"), 0, 25));
        String laterPage = codec.criteriaFingerprint(criteria("climate", List.of("NASA", "ACS"), 99, 25));
        String differentPageSize = codec.criteriaFingerprint(criteria("climate", List.of("ACS", "NASA"), 0, 50));
        String differentQuery = codec.criteriaFingerprint(criteria("water", List.of("ACS", "NASA"), 0, 25));

        assertThat(laterPage).isEqualTo(firstPage);
        assertThat(differentPageSize).isNotEqualTo(firstPage);
        assertThat(differentQuery).isNotEqualTo(firstPage);
    }

    @Test
    void rejectsEditedTokenBeforeParsingBackendPosition() {
        SearchComparisonCriteria criteria = criteria("climate", List.of("NASA"), 0, 25);
        String fingerprint = codec.criteriaFingerprint(criteria);
        String token = codec.encode("b".repeat(64), fingerprint, "SOLR", 1, "cursor-mark");
        String corrupted = token.substring(0, token.length() - 1) + (token.endsWith("0") ? "1" : "0");

        assertThatThrownBy(() -> codec.decodeAndValidate(corrupted, "b".repeat(64), fingerprint, "SOLR"))
                .isInstanceOf(SearchCursorException.class)
                .hasMessageContaining("signature");
    }

    @Test
    void rejectsTokenSignedByAnotherApplicationSecret() {
        SearchComparisonCriteria criteria = criteria("climate", List.of("NASA"), 0, 25);
        String fingerprint = codec.criteriaFingerprint(criteria);
        String token = codec.encode("b".repeat(64), fingerprint, "SOLR", 1, "cursor-mark");
        SearchCursorCodec otherCodec =
                new SearchCursorCodec(new ObjectMapper(), "another-search-cursor-secret-32-bytes");

        assertThatThrownBy(() -> otherCodec.decodeAndValidate(token, "b".repeat(64), fingerprint, "SOLR"))
                .isInstanceOf(SearchCursorException.class)
                .hasMessageContaining("signature");
    }

    @Test
    void rejectsCursorWhenProjectionChanges() {
        SearchComparisonCriteria criteria = criteria("climate", List.of(), 0, 25);
        String fingerprint = codec.criteriaFingerprint(criteria);
        String token = codec.encode("c".repeat(64), fingerprint, "SOLR", 1, "cursor-mark");

        assertThatThrownBy(() -> codec.decodeAndValidate(token, "d".repeat(64), fingerprint, "SOLR"))
                .isInstanceOf(SearchCursorException.class)
                .hasMessageContaining("projection changed");
    }

    @Test
    void rejectsCursorWhenSearchCriteriaChange() {
        String originalFingerprint = codec.criteriaFingerprint(criteria("climate", List.of(), 0, 25));
        String changedFingerprint = codec.criteriaFingerprint(criteria("climate change", List.of(), 0, 25));
        String token = codec.encode("e".repeat(64), originalFingerprint, "SOLR", 1, "cursor-mark");

        assertThatThrownBy(() ->
                        codec.decodeAndValidate(token, "e".repeat(64), changedFingerprint, "SOLR"))
                .isInstanceOf(SearchCursorException.class)
                .hasMessageContaining("search criteria");
    }

    @Test
    void rejectsCursorOwnedByAnotherBackend() {
        SearchComparisonCriteria criteria = criteria("", List.of(), 0, 25);
        String fingerprint = codec.criteriaFingerprint(criteria);
        String token = codec.encode("f".repeat(64), fingerprint, "SOLR", 1, "cursor-mark");

        assertThatThrownBy(() ->
                        codec.decodeAndValidate(token, "f".repeat(64), fingerprint, "OPENSEARCH"))
                .isInstanceOf(SearchCursorException.class)
                .hasMessageContaining("different search backend");
    }

    @Test
    void rejectsTooShortSigningSecret() {
        assertThatThrownBy(() -> new SearchCursorCodec(new ObjectMapper(), "too-short"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("at least 16 characters");
    }

    private SearchComparisonCriteria criteria(String query, List<String> programs, int page, int pageSize) {
        return new SearchComparisonCriteria(
                query,
                programs,
                "U.S. Census Bureau",
                SourceSystem.CENSUS,
                null,
                null,
                "North Dakota",
                ResearchObjectType.DATASET,
                2025,
                page,
                pageSize);
    }
}
