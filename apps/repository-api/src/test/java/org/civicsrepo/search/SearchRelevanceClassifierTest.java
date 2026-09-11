package org.civicsrepo.search;

import static org.assertj.core.api.Assertions.assertThat;

import org.civicsrepo.generated.dto.SearchRelevanceBand;
import org.junit.jupiter.api.Test;

class SearchRelevanceClassifierTest {
    @Test
    void mapsQueryRelativeScoresIntoFiveBands() {
        assertThat(SearchRelevanceClassifier.classify(10.0, 10.0).getBand())
                .isEqualTo(SearchRelevanceBand.STRONG);
        assertThat(SearchRelevanceClassifier.classify(7.0, 10.0).getBand())
                .isEqualTo(SearchRelevanceBand.GOOD);
        assertThat(SearchRelevanceClassifier.classify(5.0, 10.0).getBand())
                .isEqualTo(SearchRelevanceBand.MODERATE);
        assertThat(SearchRelevanceClassifier.classify(3.0, 10.0).getBand())
                .isEqualTo(SearchRelevanceBand.WEAK);
        assertThat(SearchRelevanceClassifier.classify(1.0, 10.0).getBand())
                .isEqualTo(SearchRelevanceBand.LOW);
    }

    @Test
    void clampsNormalizedScoreAndRejectsMissingEvidence() {
        assertThat(SearchRelevanceClassifier.classify(12.0, 10.0).getNormalizedScore()).isEqualTo(1.0);
        assertThat(SearchRelevanceClassifier.classify(null, 10.0)).isNull();
        assertThat(SearchRelevanceClassifier.classify(1.0, null)).isNull();
        assertThat(SearchRelevanceClassifier.classify(1.0, 0.0)).isNull();
    }

    @Test
    void marksTheInitialModelAsUncalibrated() {
        var model = SearchRelevanceClassifier.model();

        assertThat(model.getNormalization()).isEqualTo(SearchRelevanceClassifier.NORMALIZATION);
        assertThat(model.getCalibrated()).isFalse();
    }
}
