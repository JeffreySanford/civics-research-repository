package org.civicsrepo.search;

import org.civicsrepo.generated.dto.SearchComparisonEngine;
import org.civicsrepo.generated.dto.SearchRelevance;
import org.civicsrepo.generated.dto.SearchRelevanceBand;
import org.civicsrepo.generated.dto.SearchRelevanceModel;

final class SearchRelevanceClassifier {
    static final String NORMALIZATION = "SOLR_MAX_SCORE_RATIO_V1";

    private SearchRelevanceClassifier() {}

    static SearchRelevance classify(Double rawScore, Double maxScore) {
        if (rawScore == null || maxScore == null || rawScore < 0 || maxScore <= 0) {
            return null;
        }

        double normalizedScore = Math.max(0.0, Math.min(1.0, rawScore / maxScore));
        return new SearchRelevance(rawScore, normalizedScore, band(normalizedScore));
    }

    static SearchRelevanceModel model() {
        return new SearchRelevanceModel(SearchComparisonEngine.SOLR, NORMALIZATION, false);
    }

    private static SearchRelevanceBand band(double normalizedScore) {
        if (normalizedScore >= 0.8) {
            return SearchRelevanceBand.STRONG;
        }
        if (normalizedScore >= 0.6) {
            return SearchRelevanceBand.GOOD;
        }
        if (normalizedScore >= 0.4) {
            return SearchRelevanceBand.MODERATE;
        }
        if (normalizedScore >= 0.2) {
            return SearchRelevanceBand.WEAK;
        }
        return SearchRelevanceBand.LOW;
    }
}
