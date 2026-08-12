package org.civicsrepo.search;

import static org.assertj.core.api.Assertions.assertThat;

import org.civicsrepo.generated.dto.ResearchProgram;
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

    /**
     * The indexed term and the filter term must be the contract value, not the Java constant name.
     *
     * The generator renames a constant whose contract value puts a digit run after an underscore:
     * USGS_3DEP becomes the Java constant USGS_3_DEP, while getValue() still returns "USGS_3DEP".
     * Indexing name() would write program_s:USGS_3_DEP and no query would ever match it, so the two
     * affected programs would silently return nothing.
     */
    @Test
    void indexesTheContractValueForAProgramTheGeneratorRenames() {
        assertThat(ResearchProgram.USGS_3_DEP.getValue()).isEqualTo("USGS_3DEP");
        assertThat(ResearchProgram.USGS_3_HP.getValue()).isEqualTo("USGS_3HP");
        assertThat(ResearchProgram.USGS_3_DEP.name()).isNotEqualTo(ResearchProgram.USGS_3_DEP.getValue());
    }

    /** Every program's contract value must survive a round trip through the wire form. */
    @Test
    void everyProgramValueRoundTrips() {
        for (ResearchProgram program : ResearchProgram.values()) {
            assertThat(ResearchProgram.fromValue(program.getValue())).isEqualTo(program);
        }
    }

    @Test
    void isDisabledWithoutABaseUrlOrCore() {
        assertThat(new SolrSearchClient("", "discovery").isEnabled()).isFalse();
        assertThat(new SolrSearchClient("http://localhost:8983/solr", "").isEnabled()).isFalse();
        assertThat(new SolrSearchClient("http://localhost:8983/solr", "discovery").isEnabled())
                .isTrue();
    }
}
