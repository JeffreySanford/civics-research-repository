package org.civicsrepo.dspace;

import static org.assertj.core.api.Assertions.assertThat;
import static org.civicsrepo.dspace.DspaceDiscoveryFixtures.collection;
import static org.civicsrepo.dspace.DspaceDiscoveryFixtures.discoveryResponse;
import static org.civicsrepo.dspace.DspaceDiscoveryFixtures.item;
import static org.civicsrepo.dspace.DspaceDiscoveryFixtures.withdrawnItem;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.List;
import org.junit.jupiter.api.Test;

class DspaceRestClientTest {
    @Test
    void keepsOnlyLiveItemsFromDiscoveryResults() {
        DspaceRestClient client = new DspaceRestClient("http://localhost:8081/server", "", "");

        List<JsonNode> items = client.toDiscoverableItems(discoveryResponse(
                collection("collection-uuid", "TIGER/Line Geospatial Files"),
                withdrawnItem("withdrawn-uuid", "Withdrawn item"),
                item("live-uuid", "2025 TIGER/Line - Census Tracts - North Dakota", "tiger-line-north-dakota-2025")));

        assertThat(items).hasSize(1);
        assertThat(items.getFirst().path("uuid").asText()).isEqualTo("live-uuid");
    }

    @Test
    void preservesDiscoveryRankingOrder() {
        DspaceRestClient client = new DspaceRestClient("http://localhost:8081/server", "", "");

        List<JsonNode> items = client.toDiscoverableItems(
                discoveryResponse(item("first-uuid", "First", null), item("second-uuid", "Second", null)));

        assertThat(items).extracting((item) -> item.path("uuid").asText())
                .containsExactly("first-uuid", "second-uuid");
    }

    @Test
    void parsesNativeVersionHistoryInDspaceOrderAndMarksOnlyTheNewestArchivedVersionCurrent() {
        DspaceRestClient client = new DspaceRestClient("http://localhost:8081/server", "", "");

        List<DspaceRestClient.DspaceVersionRecord> versions = client.toVersionRecords(versionHistoryResponse(), true);

        assertThat(versions).extracting(DspaceRestClient.DspaceVersionRecord::id)
                .containsExactly("102", "101");
        assertThat(versions).extracting(DspaceRestClient.DspaceVersionRecord::version)
                .containsExactly("2", "1");
        assertThat(versions).extracting(DspaceRestClient.DspaceVersionRecord::current)
                .containsExactly(true, false);
        assertThat(versions.getFirst().summary()).isEqualTo("Author order");
        assertThat(versions.get(1).created()).isEqualTo("2015-11-03T09:44:46.617");
    }

    @Test
    void doesNotMarkAnArchivedVersionCurrentWhenHistoryReportsANewerDraft() {
        DspaceRestClient client = new DspaceRestClient("http://localhost:8081/server", "", "");

        List<DspaceRestClient.DspaceVersionRecord> versions = client.toVersionRecords(versionHistoryResponse(), false);

        assertThat(versions).extracting(DspaceRestClient.DspaceVersionRecord::current)
                .containsExactly(false, false);
    }

    @Test
    void skipsVersionRowsWithoutAuthoritativeIdentityOrVersionNumber() {
        DspaceRestClient client = new DspaceRestClient("http://localhost:8081/server", "", "");

        List<DspaceRestClient.DspaceVersionRecord> versions = client.toVersionRecords(
                """
                {
                  "_embedded": {
                    "versions": [
                      {"id": "102", "version": "2", "created": "2019-10-31T09:44:46.617"},
                      {"id": "", "version": "1"},
                      {"id": "100", "version": ""}
                    ]
                  }
                }
                """,
                true);

        assertThat(versions).singleElement().satisfies(version -> {
            assertThat(version.id()).isEqualTo("102");
            assertThat(version.current()).isTrue();
        });
    }

    @Test
    void readsAreEnabledByBaseUrlAlone() {
        DspaceRestClient client = new DspaceRestClient("http://localhost:8081/server", "", "");

        assertThat(client.isReadEnabled()).isTrue();
        assertThat(client.isWriteEnabled()).isFalse();
    }

    @Test
    void writesRequireBothCredentials() {
        assertThat(new DspaceRestClient("http://localhost:8081/server", "admin@civics.local", "  ").isWriteEnabled())
                .isFalse();
        assertThat(new DspaceRestClient("http://localhost:8081/server", "  ", "secret").isWriteEnabled())
                .isFalse();
        assertThat(new DspaceRestClient("http://localhost:8081/server", "admin@civics.local", "secret")
                        .isWriteEnabled())
                .isTrue();
    }

    @Test
    void everythingIsDisabledWithoutABaseUrl() {
        DspaceRestClient client = new DspaceRestClient("", "admin@civics.local", "secret");

        assertThat(client.isReadEnabled()).isFalse();
        assertThat(client.isWriteEnabled()).isFalse();
    }

    private String versionHistoryResponse() {
        return """
                {
                  "_embedded": {
                    "versions": [
                      {
                        "id": "102",
                        "version": "2",
                        "created": "2019-10-31T09:44:46.617",
                        "summary": "Author order"
                      },
                      {
                        "id": "101",
                        "version": "1",
                        "created": "2015-11-03T09:44:46.617",
                        "summary": "Fixing some typos"
                      }
                    ]
                  }
                }
                """;
    }
}
