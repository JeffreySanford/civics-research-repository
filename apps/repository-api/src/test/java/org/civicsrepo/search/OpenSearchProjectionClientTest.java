package org.civicsrepo.search;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.Map;
import org.civicsrepo.repository.FixtureCatalog;
import org.junit.jupiter.api.Test;

class OpenSearchProjectionClientTest {

    @Test
    void projectionUsesEngineNeutralFieldNames() {
        OpenSearchProjectionClient client = new OpenSearchProjectionClient("", "discovery-comparison");
        DiscoveryDocument object = new FixtureCatalog().discoveryDocuments().getFirst();

        Map<String, Object> document = client.toOpenSearchDocument(object);

        assertThat(document)
                .containsKeys(
                        "id",
                        "title",
                        "contentType",
                        "program",
                        "publisher",
                        "summary",
                        "accessLevel",
                        "sourceUrl")
                .doesNotContainKeys("title_txt", "program_s", "vintageYear_i", "repositorySeed_b");
        assertThat(document.get("sourceUrl")).isInstanceOf(String.class);
    }

    @Test
    void indexNameRejectsCharactersOpenSearchDoesNotAccept() {
        assertThatThrownBy(() -> new OpenSearchProjectionClient("http://localhost:9200", "Discovery Comparison"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("unsupported characters");
    }
}
