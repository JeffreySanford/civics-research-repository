package org.civicsrepo.dspace;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.Optional;
import org.civicsrepo.sources.TigerLineMetadataAdapter;
import org.civicsrepo.sync.SyncAction;
import org.junit.jupiter.api.Test;

class DspaceItemDiffPlannerTest {
    private final DspaceItemPayload sourcePayload =
            new DspaceItemPayloadMapper().toItemPayload(new TigerLineMetadataAdapter().firstVisualSlice());

    @Test
    void createsItemWhenNoExistingRepositoryPayloadIsFound() {
        DspaceItemDiffPlanner planner = new DspaceItemDiffPlanner((sourceIdentifier) -> Optional.empty());

        SyncAction action = planner.planItemDiff("tiger-line-north-dakota-2025", sourcePayload);

        assertThat(action.actionType()).isEqualTo("CREATE_ITEM");
        assertThat(action.detail()).contains("does not exist");
    }

    @Test
    void skipsItemWhenRepositoryPayloadMatchesSourcePayload() {
        DspaceItemDiffPlanner planner = new DspaceItemDiffPlanner((sourceIdentifier) -> Optional.of(sourcePayload));

        SyncAction action = planner.planItemDiff("tiger-line-north-dakota-2025", sourcePayload);

        assertThat(action.actionType()).isEqualTo("SKIP_ITEM");
        assertThat(action.detail()).contains("is current");
    }

    @Test
    void updatesItemWhenRepositoryPayloadDiffersFromSourcePayload() {
        DspaceItemPayload changedPayload =
                new DspaceItemPayload(sourcePayload.name(), sourcePayload.type(), sourcePayload.metadata(), List.of());
        DspaceItemDiffPlanner planner = new DspaceItemDiffPlanner((sourceIdentifier) -> Optional.of(changedPayload));

        SyncAction action = planner.planItemDiff("tiger-line-north-dakota-2025", sourcePayload);

        assertThat(action.actionType()).isEqualTo("UPDATE_ITEM");
        assertThat(action.detail()).contains("differs");
    }
}
