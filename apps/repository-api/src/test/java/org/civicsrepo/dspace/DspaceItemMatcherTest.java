package org.civicsrepo.dspace;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.civicsrepo.dspace.DspaceDiscoveryFixtures.discoveryResponse;
import static org.civicsrepo.dspace.DspaceDiscoveryFixtures.item;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.List;
import org.junit.jupiter.api.Test;

/**
 * DSpace discovery is relevance-ranked, so these tests pin the rule that reconciliation never
 * writes to an item it merely ranked first.
 */
class DspaceItemMatcherTest {
    private static final String SOURCE_IDENTIFIER = "tiger-line-north-dakota-2025";
    private static final String TITLE = "2025 TIGER/Line - Census Tracts - North Dakota";

    private final DspaceRestClient client = new DspaceRestClient("http://localhost:8081/server", "", "");

    @Test
    void selectsItemCarryingTheSourceIdentifier() {
        List<JsonNode> candidates = client.toDiscoverableItems(discoveryResponse(
                item("other-uuid", "2025 TIGER/Line - Census Tracts - South Dakota", "tiger-line-south-dakota-2025"),
                item("target-uuid", TITLE, SOURCE_IDENTIFIER)));

        JsonNode selected =
                DspaceItemMatcher.selectTargetItem(candidates, SOURCE_IDENTIFIER, TITLE).orElseThrow();

        assertThat(selected.path("uuid").asText()).isEqualTo("target-uuid");
    }

    @Test
    void ignoresHigherRankedItemsThatDoNotMatchTheSourceIdentifier() {
        List<JsonNode> candidates = client.toDiscoverableItems(discoveryResponse(
                item("sibling-uuid", "2025 TIGER/Line - Census Tracts - Texas", "tiger-line-texas-2025"),
                item("second-sibling-uuid", "2025 TIGER/Line - Census Tracts - California", "tiger-line-california-2025")));

        assertThat(DspaceItemMatcher.selectTargetItem(candidates, SOURCE_IDENTIFIER, TITLE))
                .isEmpty();
    }

    @Test
    void adoptsUnclaimedItemWhenTitleMatchesExactly() {
        List<JsonNode> candidates = client.toDiscoverableItems(discoveryResponse(
                item("claimed-uuid", "2025 TIGER/Line - Census Tracts - Texas", "tiger-line-texas-2025"),
                item("seed-uuid", TITLE, null)));

        JsonNode selected =
                DspaceItemMatcher.selectTargetItem(candidates, SOURCE_IDENTIFIER, TITLE).orElseThrow();

        assertThat(selected.path("uuid").asText()).isEqualTo("seed-uuid");
    }

    @Test
    void refusesToAdoptAnItemAlreadyClaimedByAnotherSource() {
        List<JsonNode> candidates =
                client.toDiscoverableItems(discoveryResponse(item("claimed-uuid", TITLE, "some-other-source")));

        assertThat(DspaceItemMatcher.selectTargetItem(candidates, SOURCE_IDENTIFIER, TITLE))
                .isEmpty();
    }

    @Test
    void refusesToAdoptOnPartialTitleMatch() {
        List<JsonNode> candidates = client.toDiscoverableItems(
                discoveryResponse(item("near-miss-uuid", TITLE + " (Revised)", null)));

        assertThat(DspaceItemMatcher.selectTargetItem(candidates, SOURCE_IDENTIFIER, TITLE))
                .isEmpty();
    }

    @Test
    void failsWhenTwoItemsCarryTheSameSourceIdentifier() {
        List<JsonNode> candidates = client.toDiscoverableItems(discoveryResponse(
                item("first-uuid", TITLE, SOURCE_IDENTIFIER), item("second-uuid", TITLE, SOURCE_IDENTIFIER)));

        assertThatThrownBy(() -> DspaceItemMatcher.selectTargetItem(candidates, SOURCE_IDENTIFIER, TITLE))
                .isInstanceOf(AmbiguousDspaceItemException.class)
                .hasMessageContaining(SOURCE_IDENTIFIER);
    }

    @Test
    void failsWhenTwoUnclaimedItemsShareTheExpectedTitle() {
        List<JsonNode> candidates = client.toDiscoverableItems(
                discoveryResponse(item("first-uuid", TITLE, null), item("second-uuid", TITLE, null)));

        assertThatThrownBy(() -> DspaceItemMatcher.selectTargetItem(candidates, SOURCE_IDENTIFIER, TITLE))
                .isInstanceOf(AmbiguousDspaceItemException.class)
                .hasMessageContaining(TITLE);
    }

    @Test
    void returnsEmptyWhenDiscoveryFoundNothing() {
        assertThat(DspaceItemMatcher.selectTargetItem(List.of(), SOURCE_IDENTIFIER, TITLE))
                .isEmpty();
    }
}
