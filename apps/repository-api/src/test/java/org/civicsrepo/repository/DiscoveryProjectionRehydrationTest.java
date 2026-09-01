package org.civicsrepo.repository;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import org.civicsrepo.federation.CombinedDiscoveryCatalog;
import org.civicsrepo.federation.CorpusProfile;
import org.civicsrepo.federation.CorpusProfileActivation;
import org.civicsrepo.generated.dto.RepositorySource;
import org.civicsrepo.search.DiscoveryDocument;
import org.civicsrepo.search.DiscoveryProjectionTarget;
import org.junit.jupiter.api.Test;

class DiscoveryProjectionRehydrationTest {
    private static final String PROJECTION_ID = "3d461a9feb49f7239f3f6aaacb0c90f1ff43d0c683238acc2202c841154db44d";

    @Test
    void rehydratesPersistedIdentityWhenEveryEnabledTargetMatchesTheRecordedCount() {
        RepositoryCatalog repositoryCatalog = mock(RepositoryCatalog.class);
        CombinedDiscoveryCatalog combinedCatalog = mock(CombinedDiscoveryCatalog.class);
        RepositoryIdentityStore identityStore = mock(RepositoryIdentityStore.class);
        DiscoveryProjectionTarget solr = target("discovery", 1_000_181);
        DiscoveryProjectionTarget openSearch = target("discovery-comparison", 1_000_181);
        when(repositoryCatalog.findAllDiscoveryDocuments()).thenReturn(List.of(mock(DiscoveryDocument.class)));
        when(combinedCatalog.retainedFederatedCount()).thenReturn(1_000_000L);

        DiscoveryProjectionService service = new DiscoveryProjectionService(
                repositoryCatalog,
                combinedCatalog,
                List.of(solr, openSearch),
                identityStore);
        CorpusProfileActivation activation = activation(1_000_181);

        DiscoveryProjectionService.ProjectionState state = service.rehydrate(activation);

        assertThat(state.source()).isEqualTo(RepositorySource.REPOSITORY);
        assertThat(state.objectCount()).isEqualTo(1_000_181);
        assertThat(state.rebuiltAt()).isNull();
        assertThat(service.currentProjectionId()).isEqualTo(PROJECTION_ID);
        assertThat(service.targetState("discovery").projectionId()).isEqualTo(PROJECTION_ID);
        assertThat(service.targetState("discovery").documentCount()).isEqualTo(1_000_181);
        assertThat(service.targetState("discovery-comparison").projectionId()).isEqualTo(PROJECTION_ID);
        assertThat(service.targetState("discovery-comparison").documentCount()).isEqualTo(1_000_181);
        verifyNoRebuild(solr);
        verifyNoRebuild(openSearch);
    }

    @Test
    void rejectsPersistedIdentityWhenAnEnabledTargetHasDriftedWithoutMutatingTheIndex() {
        RepositoryCatalog repositoryCatalog = mock(RepositoryCatalog.class);
        CombinedDiscoveryCatalog combinedCatalog = mock(CombinedDiscoveryCatalog.class);
        RepositoryIdentityStore identityStore = mock(RepositoryIdentityStore.class);
        DiscoveryProjectionTarget solr = target("discovery", 1_000_181);
        DiscoveryProjectionTarget openSearch = target("discovery-comparison", 181);

        DiscoveryProjectionService service = new DiscoveryProjectionService(
                repositoryCatalog,
                combinedCatalog,
                List.of(solr, openSearch),
                identityStore);

        assertThatThrownBy(() -> service.rehydrate(activation(1_000_181)))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("discovery-comparison")
                .hasMessageContaining("expected 1000181")
                .hasMessageContaining("found 181");

        assertThat(service.currentProjectionId()).isNull();
        assertThat(service.state().objectCount()).isZero();
        verifyNoRebuild(solr);
        verifyNoRebuild(openSearch);
    }

    private static DiscoveryProjectionTarget target(String indexName, int count) {
        DiscoveryProjectionTarget target = mock(DiscoveryProjectionTarget.class);
        when(target.isEnabled()).thenReturn(true);
        when(target.isReachable()).thenReturn(true);
        when(target.indexName()).thenReturn(indexName);
        when(target.documentCount()).thenReturn(Optional.of(count));
        return target;
    }

    private static CorpusProfileActivation activation(long count) {
        return new CorpusProfileActivation(
                CorpusProfile.FEDERATED_1M,
                PROJECTION_ID,
                count,
                OffsetDateTime.parse("2026-09-01T14:47:32Z"));
    }

    private static void verifyNoRebuild(DiscoveryProjectionTarget target) {
        verify(target, never()).beginProjection();
        verify(target, never()).indexBatch(org.mockito.ArgumentMatchers.anyList());
        verify(target, never()).completeProjection();
        verify(target, never()).abortProjection();
    }
}
