package org.civicsrepo.repository;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.net.URI;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import org.civicsrepo.federation.CombinedDiscoveryCatalog;
import org.civicsrepo.federation.CombinedDiscoveryCatalog.DiscoveryCursor;
import org.civicsrepo.federation.CombinedDiscoveryCatalog.DiscoveryPage;
import org.civicsrepo.federation.CorpusProfile;
import org.civicsrepo.generated.dto.RepositorySource;
import org.civicsrepo.generated.dto.ResearchObjectOrigin;
import org.civicsrepo.generated.dto.ResearchObjectType;
import org.civicsrepo.generated.dto.ResearchProgram;
import org.civicsrepo.generated.dto.SearchResult;
import org.civicsrepo.generated.dto.SourceSystem;
import org.civicsrepo.search.DiscoveryDocument;
import org.civicsrepo.search.DiscoveryProjectionTarget;
import org.junit.jupiter.api.Test;

class DiscoveryProjectionServiceTest {
    @Test
    void streamsTheSameBoundedPagesToEveryTargetAndRecordsOnlyRepositoryIdentity() {
        RepositoryCatalog repositoryCatalog = mock(RepositoryCatalog.class);
        CombinedDiscoveryCatalog combinedCatalog = mock(CombinedDiscoveryCatalog.class);
        RepositoryIdentityStore identityStore = mock(RepositoryIdentityStore.class);
        RecordingTarget solr = new RecordingTarget("discovery", false);
        RecordingTarget openSearch = new RecordingTarget("discovery-comparison", false);

        DiscoveryDocument repositoryOne = document("repo-001", ResearchObjectOrigin.REPOSITORY, "ACS");
        DiscoveryDocument repositoryTwo = document("repo-002", ResearchObjectOrigin.REPOSITORY, "LODES");
        DiscoveryDocument federatedOne = document("DOE_OSTI:001", ResearchObjectOrigin.FEDERATED, "Office of Science");
        DiscoveryDocument federatedTwo = document("DOE_OSTI:002", ResearchObjectOrigin.FEDERATED, "Office of Science");
        DiscoveryDocument federatedThree = document("DOE_OSTI:003", ResearchObjectOrigin.FEDERATED, "Energy Efficiency");
        List<DiscoveryDocument> firstBatch = List.of(repositoryOne, repositoryTwo, federatedOne, federatedTwo);
        List<DiscoveryDocument> secondBatch = List.of(federatedThree);
        DiscoveryCursor next = new DiscoveryCursor(2, "DOE_OSTI:002");

        when(repositoryCatalog.findAllDiscoveryDocuments()).thenReturn(List.of(repositoryOne, repositoryTwo));
        when(combinedCatalog.retainedFederatedCount()).thenReturn(3L);
        when(combinedCatalog.findAfter(isNull(), eq(1_000)))
                .thenReturn(new DiscoveryPage(firstBatch, next, false));
        when(combinedCatalog.findAfter(eq(next), eq(1_000)))
                .thenReturn(new DiscoveryPage(secondBatch, null, true));

        DiscoveryProjectionService service = new DiscoveryProjectionService(
                repositoryCatalog,
                combinedCatalog,
                List.of(solr, openSearch),
                identityStore);

        DiscoveryProjectionService.ProjectionState state = service.reindex(List.of());

        DiscoveryProjectionDigest expectedDigest = new DiscoveryProjectionDigest();
        expectedDigest.updateBatch(firstBatch);
        expectedDigest.updateBatch(secondBatch);
        String expectedProjectionId = expectedDigest.finish();

        assertThat(state.source()).isEqualTo(RepositorySource.REPOSITORY);
        assertThat(state.objectCount()).isEqualTo(5);
        assertThat(service.currentProjectionId()).isEqualTo(expectedProjectionId);
        assertThat(solr.batches).containsExactly(firstBatch, secondBatch);
        assertThat(openSearch.batches).containsExactly(firstBatch, secondBatch);
        assertThat(solr.completed).isTrue();
        assertThat(openSearch.completed).isTrue();
        assertThat(service.targetState("discovery").projectionId()).isEqualTo(expectedProjectionId);
        assertThat(service.targetState("discovery-comparison").projectionId()).isEqualTo(expectedProjectionId);
        verify(identityStore).recordIndexed(List.of("repo-001", "repo-002"));
        verify(combinedCatalog).findAfter(null, 1_000);
        verify(combinedCatalog).findAfter(next, 1_000);
    }

    @Test
    void curatedDemoProjectsRepositoryOnlyEvenWhenFederatedMetadataIsRetained() {
        RepositoryCatalog repositoryCatalog = mock(RepositoryCatalog.class);
        CombinedDiscoveryCatalog combinedCatalog = mock(CombinedDiscoveryCatalog.class);
        RepositoryIdentityStore identityStore = mock(RepositoryIdentityStore.class);
        RecordingTarget target = new RecordingTarget("discovery", false);
        DiscoveryDocument repositoryOne = document("repo-001", ResearchObjectOrigin.REPOSITORY, "ACS");
        DiscoveryDocument repositoryTwo = document("repo-002", ResearchObjectOrigin.REPOSITORY, "LODES");

        when(repositoryCatalog.findAllDiscoveryDocuments()).thenReturn(List.of(repositoryTwo, repositoryOne));
        when(combinedCatalog.retainedFederatedCount()).thenReturn(10_000L);

        DiscoveryProjectionService service = new DiscoveryProjectionService(
                repositoryCatalog,
                combinedCatalog,
                List.of(target),
                identityStore);

        DiscoveryProjectionService.ProjectionState state =
                service.reindex(CorpusProfile.CURATED_DEMO, List.of());

        assertThat(state.objectCount()).isEqualTo(2);
        assertThat(target.batches).containsExactly(List.of(repositoryOne, repositoryTwo));
        verify(combinedCatalog, never()).findAfter(isNull(), eq(1_000));
        verify(identityStore).recordIndexed(List.of("repo-001", "repo-002"));
    }

    @Test
    void namedFederatedProfileRefusesToProjectBeforeItsRetainedBoundExists() {
        RepositoryCatalog repositoryCatalog = mock(RepositoryCatalog.class);
        CombinedDiscoveryCatalog combinedCatalog = mock(CombinedDiscoveryCatalog.class);
        RepositoryIdentityStore identityStore = mock(RepositoryIdentityStore.class);
        RecordingTarget target = new RecordingTarget("discovery", false);

        when(repositoryCatalog.findAllDiscoveryDocuments()).thenReturn(List.of());
        when(combinedCatalog.retainedFederatedCount()).thenReturn(9_999L);

        DiscoveryProjectionService service = new DiscoveryProjectionService(
                repositoryCatalog,
                combinedCatalog,
                List.of(target),
                identityStore);

        assertThatThrownBy(() -> service.reindex(CorpusProfile.FEDERATED_10K, List.of()))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("requires 10000 retained federated records")
                .hasMessageContaining("9999 are available");
        assertThat(target.begun).isFalse();
    }

    @Test
    void oneTargetCanAbortMidStreamWhileTheOtherCompletes() {
        RepositoryCatalog repositoryCatalog = mock(RepositoryCatalog.class);
        CombinedDiscoveryCatalog combinedCatalog = mock(CombinedDiscoveryCatalog.class);
        RepositoryIdentityStore identityStore = mock(RepositoryIdentityStore.class);
        RecordingTarget failing = new RecordingTarget("discovery", true);
        RecordingTarget surviving = new RecordingTarget("discovery-comparison", false);

        DiscoveryDocument repository = document("repo-001", ResearchObjectOrigin.REPOSITORY, "ACS");
        DiscoveryDocument federated = document("DATA_GOV:001", ResearchObjectOrigin.FEDERATED, "Climate Program");
        DiscoveryCursor next = new DiscoveryCursor(1, null);

        when(repositoryCatalog.findAllDiscoveryDocuments()).thenReturn(List.of(repository));
        when(combinedCatalog.retainedFederatedCount()).thenReturn(1L);
        when(combinedCatalog.findAfter(isNull(), eq(1_000)))
                .thenReturn(new DiscoveryPage(List.of(repository), next, false));
        when(combinedCatalog.findAfter(eq(next), eq(1_000)))
                .thenReturn(new DiscoveryPage(List.of(federated), null, true));

        DiscoveryProjectionService service = new DiscoveryProjectionService(
                repositoryCatalog,
                combinedCatalog,
                List.of(failing, surviving),
                identityStore);

        DiscoveryProjectionService.ProjectionState state = service.reindex(List.of());

        assertThat(state.objectCount()).isEqualTo(2);
        assertThat(failing.aborted).isTrue();
        assertThat(failing.completed).isFalse();
        assertThat(service.targetState("discovery").projected()).isFalse();
        assertThat(service.targetState("discovery").warning()).contains("simulated batch failure");
        assertThat(surviving.batches).containsExactly(List.of(repository), List.of(federated));
        assertThat(surviving.completed).isTrue();
        assertThat(service.targetState("discovery-comparison").projected()).isTrue();
        verify(identityStore).recordIndexed(List.of("repo-001"));
    }

    @Test
    void fallsBackToDeterministicallySortedFixturesWhenNoAuthorityHasRecords() {
        RepositoryCatalog repositoryCatalog = mock(RepositoryCatalog.class);
        CombinedDiscoveryCatalog combinedCatalog = mock(CombinedDiscoveryCatalog.class);
        RepositoryIdentityStore identityStore = mock(RepositoryIdentityStore.class);
        RecordingTarget target = new RecordingTarget("discovery", false);

        when(repositoryCatalog.findAllDiscoveryDocuments()).thenReturn(List.of());
        when(combinedCatalog.retainedFederatedCount()).thenReturn(0L);
        DiscoveryDocument second = document("fixture-002", ResearchObjectOrigin.FIXTURE, "LODES");
        DiscoveryDocument first = document("fixture-001", ResearchObjectOrigin.FIXTURE, "ACS");

        DiscoveryProjectionService service = new DiscoveryProjectionService(
                repositoryCatalog,
                combinedCatalog,
                List.of(target),
                identityStore);

        DiscoveryProjectionService.ProjectionState state = service.reindex(List.of(second, first));

        assertThat(state.source()).isEqualTo(RepositorySource.FIXTURE);
        assertThat(target.batches).containsExactly(List.of(first, second));
        assertThat(state.objectCount()).isEqualTo(2);
    }

    private static DiscoveryDocument document(String id, ResearchObjectOrigin origin, String programName) {
        SearchResult result = new SearchResult(
                        id,
                        "Title " + id,
                        origin == ResearchObjectOrigin.FEDERATED ? ResearchObjectType.PUBLICATION : ResearchObjectType.DATASET,
                        legacyProgram(programName),
                        origin == ResearchObjectOrigin.FEDERATED ? "External publisher" : "U.S. Census Bureau",
                        "Summary",
                        URI.create("https://example.gov/" + id.replace(':', '/')),
                        origin,
                        sourceSystem(origin))
                .programName(programName);
        return DiscoveryDocument.of(result);
    }

    private static ResearchProgram legacyProgram(String programName) {
        try {
            return ResearchProgram.fromValue(programName);
        } catch (IllegalArgumentException exception) {
            return ResearchProgram.OTHER;
        }
    }

    private static SourceSystem sourceSystem(ResearchObjectOrigin origin) {
        return switch (origin) {
            case FEDERATED -> SourceSystem.DOE_OSTI;
            case REPOSITORY, FIXTURE -> SourceSystem.CENSUS;
        };
    }

    private static final class RecordingTarget implements DiscoveryProjectionTarget {
        private final String indexName;
        private final boolean failOnSecondBatch;
        private final List<List<DiscoveryDocument>> batches = new ArrayList<>();
        private boolean begun;
        private boolean completed;
        private boolean aborted;
        private int batchCalls;
        private int count;

        private RecordingTarget(String indexName, boolean failOnSecondBatch) {
            this.indexName = indexName;
            this.failOnSecondBatch = failOnSecondBatch;
        }

        @Override
        public boolean isEnabled() {
            return true;
        }

        @Override
        public boolean isReachable() {
            return true;
        }

        @Override
        public String baseUrl() {
            return "http://example.invalid";
        }

        @Override
        public String indexName() {
            return indexName;
        }

        @Override
        public Optional<Integer> documentCount() {
            return Optional.of(count);
        }

        @Override
        public void beginProjection() {
            begun = true;
            count = 0;
        }

        @Override
        public void indexBatch(List<DiscoveryDocument> objects) {
            if (!begun) {
                throw new IllegalStateException("projection not begun");
            }
            batchCalls++;
            if (failOnSecondBatch && batchCalls == 2) {
                throw new IllegalStateException("simulated batch failure");
            }
            batches.add(objects);
            count += objects.size();
        }

        @Override
        public void completeProjection() {
            completed = true;
        }

        @Override
        public void abortProjection() {
            aborted = true;
        }
    }
}
