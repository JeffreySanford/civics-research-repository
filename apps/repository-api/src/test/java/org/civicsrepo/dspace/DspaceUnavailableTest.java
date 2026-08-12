package org.civicsrepo.dspace;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.List;
import java.util.Map;
import org.civicsrepo.sources.TigerLineMetadataAdapter;
import org.civicsrepo.sources.OfflineSourceFileProbe;
import org.junit.jupiter.api.Test;

/**
 * Being unable to reach DSpace must never be reported as "the item is not there".
 *
 * <p>Port 1 is closed, so these exercise a real connection failure rather than a mocked one.
 */
class DspaceUnavailableTest {
    private static final String UNREACHABLE = "http://localhost:1/server";
    private static final String SOURCE_IDENTIFIER = "tiger-line-north-dakota-2025";

    private final DspaceItemPayload sourcePayload =
            new DspaceItemPayloadMapper().toItemPayload(new TigerLineMetadataAdapter(new OfflineSourceFileProbe()).firstVisualSlice());

    @Test
    void reportsAnUnreachableEndpointAsUnavailableRatherThanEmpty() {
        DspaceRestClient client = new DspaceRestClient(UNREACHABLE, "admin@civics.local", "secret");

        assertThatThrownBy(() -> client.searchItems(SOURCE_IDENTIFIER))
                .isInstanceOf(DspaceUnavailableException.class)
                .hasMessageContaining(UNREACHABLE)
                .hasMessageContaining("pnpm run dspace:up");
    }

    @Test
    void reachabilityProbeReportsFalseInsteadOfThrowing() {
        assertThat(new DspaceRestClient(UNREACHABLE, "", "").isReachable()).isFalse();
        assertThat(new DspaceRestClient("", "", "").isReachable()).isFalse();
    }

    /**
     * The diff path previously swallowed this and returned empty, which made the planner report
     * CREATE_ITEM for an item it had never actually looked for.
     */
    @Test
    void diffReadFailsInsteadOfClaimingTheItemIsAbsent() {
        DspaceDiscoveryItemStateReader reader =
                new DspaceDiscoveryItemStateReader(new DspaceRestClient(UNREACHABLE, "", ""));

        assertThatThrownBy(() -> reader.findMatchingItem(SOURCE_IDENTIFIER, sourcePayload))
                .isInstanceOf(DspaceUnavailableException.class)
                .hasMessageContaining(UNREACHABLE);
    }

    @Test
    void diffPlanningPropagatesUnavailabilityRatherThanPlanningACreate() {
        DspaceItemDiffPlanner planner = new DspaceItemDiffPlanner(
                new DspaceDiscoveryItemStateReader(new DspaceRestClient(UNREACHABLE, "", "")));

        assertThatThrownBy(() -> planner.planItemDiff(SOURCE_IDENTIFIER, sourcePayload))
                .isInstanceOf(DspaceUnavailableException.class);
    }

    @Test
    void applyFailsWithAnActionableMessage() {
        DspaceRestItemWriteGateway gateway =
                new DspaceRestItemWriteGateway(new DspaceRestClient(UNREACHABLE, "admin@civics.local", "secret"));

        assertThatThrownBy(() -> gateway.ensureItemMetadata(SOURCE_IDENTIFIER, sourcePayload))
                .isInstanceOf(DspaceUnavailableException.class)
                .hasMessageContaining(UNREACHABLE);
    }

    /** A configured-but-unreachable DSpace still reports no state when DSpace is not configured at all. */
    @Test
    void anUnconfiguredEndpointIsNotTreatedAsAnOutage() {
        DspaceDiscoveryItemStateReader reader =
                new DspaceDiscoveryItemStateReader(new DspaceRestClient("", "", ""));

        assertThat(reader.findMatchingItem(SOURCE_IDENTIFIER, sourcePayload)).isEmpty();
    }

    @Test
    void unavailabilityMessageNamesTheStatusCodeForANonTransportFailure() {
        DspaceUnavailableException exception = new DspaceUnavailableException(UNREACHABLE, 502);

        assertThat(exception).hasMessageContaining("502").hasMessageContaining(UNREACHABLE);
    }

    @Test
    void patchIsNeverAttemptedWithoutCredentials() {
        DspaceRestItemWriteGateway gateway =
                new DspaceRestItemWriteGateway(new DspaceRestClient(UNREACHABLE, "", ""));

        assertThat(gateway.ensureItemMetadata(SOURCE_IDENTIFIER, sourcePayload)).isFalse();
    }

    @Test
    void metadataPatchOperationsRemainPureAndOffline() {
        DspaceRestClient client = new DspaceRestClient(UNREACHABLE, "", "");
        DspaceRestItemWriteGateway gateway = new DspaceRestItemWriteGateway(client);
        var item = client
                .toDiscoverableItems(DspaceDiscoveryFixtures.discoveryResponse(
                        DspaceDiscoveryFixtures.item("uuid", sourcePayload.name(), SOURCE_IDENTIFIER)))
                .getFirst();

        List<Map<String, Object>> operations =
                gateway.metadataPatchOperations(item, SOURCE_IDENTIFIER, sourcePayload);

        assertThat(operations).isNotEmpty();
    }
}
