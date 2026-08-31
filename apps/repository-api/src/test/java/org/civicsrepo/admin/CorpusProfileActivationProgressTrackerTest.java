package org.civicsrepo.admin;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.civicsrepo.admin.CorpusProfileActivationProgress.Phase;
import org.civicsrepo.federation.CorpusProfile;
import org.junit.jupiter.api.Test;

class CorpusProfileActivationProgressTrackerTest {
    @Test
    void reportsExactDocumentProgressAndCompletion() {
        CorpusProfileActivationProgressTracker tracker = new CorpusProfileActivationProgressTracker();

        tracker.begin(CorpusProfile.FEDERATED_100K);
        tracker.projectionStarted(100_187);
        tracker.projected(42_000, 100_187);

        CorpusProfileActivationProgress projecting = tracker.current();
        assertThat(projecting.profile()).isEqualTo(CorpusProfile.FEDERATED_100K);
        assertThat(projecting.phase()).isEqualTo(Phase.PROJECTING);
        assertThat(projecting.processedDocuments()).isEqualTo(42_000);
        assertThat(projecting.totalDocuments()).isEqualTo(100_187);
        assertThat(projecting.percentComplete()).isEqualTo(41);

        tracker.verifying(100_187, 100_187);
        assertThat(tracker.current().phase()).isEqualTo(Phase.VERIFYING);
        assertThat(tracker.current().percentComplete()).isEqualTo(100);

        tracker.complete(100_187, 100_187);
        assertThat(tracker.current().phase()).isEqualTo(Phase.COMPLETED);
        assertThat(tracker.current().percentComplete()).isEqualTo(100);
        assertThat(tracker.current().completedAt()).isNotNull();
    }

    @Test
    void carriesOneOperationAcrossHarvestSnapshotProjectionAndEvidencePhases() {
        CorpusProfileActivationProgressTracker tracker = new CorpusProfileActivationProgressTracker();
        String operationId = tracker.begin(CorpusProfile.FEDERATED_100K);

        tracker.harvesting(42_000, 100_000);
        CorpusProfileActivationProgress harvesting = tracker.current();
        assertThat(harvesting.operationId()).isEqualTo(operationId);
        assertThat(harvesting.phase()).isEqualTo(Phase.HARVESTING);
        assertThat(harvesting.processedDocuments()).isEqualTo(42_000);
        assertThat(harvesting.totalDocuments()).isEqualTo(100_000);
        assertThat(harvesting.percentComplete()).isEqualTo(42);

        tracker.snapshotting(100_000);
        assertThat(tracker.current().phase()).isEqualTo(Phase.SNAPSHOTTING);
        assertThat(tracker.current().percentComplete()).isEqualTo(100);

        tracker.projectionStarted(100_187);
        tracker.projected(50_000, 100_187);
        assertThat(tracker.current().phase()).isEqualTo(Phase.PROJECTING);

        tracker.verifying(100_187, 100_187);
        assertThat(tracker.current().phase()).isEqualTo(Phase.VERIFYING);

        tracker.capturingEvidence(100_187, 100_187);
        assertThat(tracker.current().phase()).isEqualTo(Phase.CAPTURING_EVIDENCE);
        assertThat(tracker.current().operationId()).isEqualTo(operationId);
    }

    @Test
    void rejectsAConcurrentActivation() {
        CorpusProfileActivationProgressTracker tracker = new CorpusProfileActivationProgressTracker();
        tracker.begin(CorpusProfile.FEDERATED_10K);

        assertThatThrownBy(() -> tracker.begin(CorpusProfile.CURATED_DEMO))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("already in progress")
                .hasMessageContaining("FEDERATED_10K");
    }

    @Test
    void retainsFailureReasonForOperatorDiagnostics() {
        CorpusProfileActivationProgressTracker tracker = new CorpusProfileActivationProgressTracker();
        tracker.begin(CorpusProfile.FEDERATED_100K);
        tracker.fail(new IllegalStateException(
                "Corpus profile FEDERATED_100K requires 100000 retained federated records; only 10000 are available."));

        CorpusProfileActivationProgress failed = tracker.current();
        assertThat(failed.phase()).isEqualTo(Phase.FAILED);
        assertThat(failed.message()).contains("100000").contains("10000");
        assertThat(failed.completedAt()).isNotNull();
    }
}
