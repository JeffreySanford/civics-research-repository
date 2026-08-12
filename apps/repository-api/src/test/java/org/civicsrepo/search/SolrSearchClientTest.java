package org.civicsrepo.search;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class SolrSearchClientTest {
    @Test
    void leavesOrdinaryGeographyValuesUntouched() {
        assertThat(SolrSearchClient.escapeQueryValue("North Dakota")).isEqualTo("North Dakota");
    }

    /**
     * The value is interpolated into {@code geography_s:"<value>"}. An unescaped quote would close
     * the phrase and let the remainder of the value be parsed as Lucene query syntax.
     */
    @Test
    void escapesQuotesSoAFilterValueCannotCloseItsOwnPhrase() {
        assertThat(SolrSearchClient.escapeQueryValue("North\" OR program_s:*")).isEqualTo("North\\\" OR program_s:*");
    }

    @Test
    void escapesBackslashesSoTheyCannotEscapeTheClosingQuote() {
        assertThat(SolrSearchClient.escapeQueryValue("North\\")).isEqualTo("North\\\\");
    }

    @Test
    void treatsANullValueAsEmpty() {
        assertThat(SolrSearchClient.escapeQueryValue(null)).isEmpty();
    }

    @Test
    void isDisabledWithoutABaseUrlOrCore() {
        assertThat(new SolrSearchClient("", "discovery").isEnabled()).isFalse();
        assertThat(new SolrSearchClient("http://localhost:8983/solr", "").isEnabled()).isFalse();
        assertThat(new SolrSearchClient("http://localhost:8983/solr", "discovery").isEnabled())
                .isTrue();
    }
}
