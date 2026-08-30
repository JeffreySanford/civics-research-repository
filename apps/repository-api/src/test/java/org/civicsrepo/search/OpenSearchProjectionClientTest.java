package org.civicsrepo.search;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.Map;
import org.civicsrepo.repository.FixtureCatalog;
import org.junit.jupiter.api.Test;

class OpenSearchProjectionClientTest {

    @Test
    void projectionUsesEngineNeutralFieldNamesAndPreservesProvenance() {
        OpenSearchProjectionClient client = new OpenSearchProjectionClient("", "discovery-comparison");
        DiscoveryDocument object = new FixtureCatalog().discoveryDocuments().getFirst();

        Map<String, Object> document = client.toOpenSearchDocument(object);

        assertThat(document)
                .containsKeys(
                        "id",
                        "title",
                        "contentType",
                        "program",
                        "programName",
                        "publisher",
                        "summary",
                        "accessLevel",
                        "sourceUrl",
                        "origin",
                        "sourceSystem")
                .doesNotContainKeys("title_txt", "program_s", "vintageYear_i", "repositorySeed_b");
        assertThat(document.get("programName")).isEqualTo(object.programName());
        assertThat(document.get("sourceUrl")).isInstanceOf(String.class);
        assertThat(document.get("origin")).isEqualTo("FIXTURE");
        assertThat(document.get("sourceSystem")).isIn("CENSUS", "USGS", "OTHER");
    }

    @Test
    void indexNameRejectsCharactersOpenSearchDoesNotAccept() {
        assertThatThrownBy(() -> new OpenSearchProjectionClient("http://localhost:9200", "Discovery Comparison"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("unsupported characters");
    }
}
