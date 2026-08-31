package org.civicsrepo.repository;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.net.URI;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import org.civicsrepo.federation.CombinedDiscoveryCatalog;
import org.civicsrepo.federation.CombinedDiscoveryCatalog.FederatedDiscoveryPage;
import org.civicsrepo.federation.CorpusProfile;
import org.civicsrepo.federation.FederatedCompositeCorpusManifest;
import org.civicsrepo.federation.FederatedCompositeCorpusSource;
import org.civicsrepo.federation.FederatedSourceSystem;
import org.civicsrepo.generated.dto.ResearchObjectOrigin;
import org.civicsrepo.generated.dto.ResearchObjectType;
import org.civicsrepo.generated.dto.ResearchProgram;
import org.civicsrepo.generated.dto.SearchResult;
import org.civicsrepo.generated.dto.SourceSystem;
import org.civicsrepo.search.DiscoveryDocument;
import org.civicsrepo.search.DiscoveryProjectionTarget;
import org.junit.jupiter.api.Test;

class DiscoveryCompositeProjectionServiceTest {
    @Test
    void projectsRepositoryThenExactQuotaForEachComposedSource() {
        RepositoryCatalog repositoryCatalog = mock(RepositoryCatalog.class);
        CombinedDiscoveryCatalog combinedCatalog = mock(CombinedDiscoveryCatalog.class);
        RepositoryIdentityStore identityStore = mock(RepositoryIdentityStore.class);
        RecordingTarget solr = new RecordingTarget("discovery");
        RecordingTarget openSearch = new RecordingTarget("discovery-comparison");
        DiscoveryDocument repository = document("repo-001", ResearchObjectOrigin.REPOSITORY, SourceSystem.CENSUS);
        List<DiscoveryDocument> dataGov = List.of(
                document("DATA_GOV:001", ResearchObjectOrigin.FEDERATED, SourceSystem.DATA_GOV),
                document("DATA_GOV:002", ResearchObjectOrigin.FEDERATED, SourceSystem.DATA_GOV));
        List<DiscoveryDocument> osti = List.of(
                document("DOE_OSTI:001", ResearchObjectOrigin.FEDERATED, SourceSystem.DOE_OSTI),
                document("DOE_OSTI:002", ResearchObjectOrigin.FEDERATED, SourceSystem.DOE_OSTI));
        FederatedCompositeCorpusManifest composition = composition(2, 2);

        when(repositoryCatalog.findAllDiscoveryDocuments()).thenReturn(List.of(repository));
        when(combinedCatalog.findFederatedAfter(eq(FederatedSourceSystem.DATA_GOV), isNull(), eq(2)))
                .thenReturn(new FederatedDiscoveryPage(dataGov, "DATA_GOV:002", false));
        when(combinedCatalog.findFederatedAfter(eq(FederatedSourceSystem.DOE_OSTI), isNull(), eq(2)))
                .thenReturn(new FederatedDiscoveryPage(osti, "DOE_OSTI:002", false));

        DiscoveryProjectionService service = new DiscoveryProjectionService(
                repositoryCatalog, combinedCatalog, List.of(solr, openSearch), identityStore);

        DiscoveryProjectionService.ProjectionState projected = service.reindex(composition);

        DiscoveryProjectionDigest digest = new DiscoveryProjectionDigest();
        digest.updateBatch(List.of(repository));
        digest.updateBatch(dataGov);
        digest.updateBatch(osti);
        String expectedProjectionId = digest.finish();

        assertThat(projected.objectCount()).isEqualTo(5);
        assertThat(service.currentProjectionId()).isEqualTo(expectedProjectionId);
        assertThat(solr.batches).containsExactly(List.of(repository), dataGov, osti);
        assertThat(openSearch.batches).containsExactly(List.of(repository), dataGov, osti);
        assertThat(solr.aborted).isFalse();
        assertThat(openSearch.aborted).isFalse();
        assertThat(service.targetState("discovery").projectionId()).isEqualTo(expectedProjectionId);
        assertThat(service.targetState("discovery-comparison").projectionId()).isEqualTo(expectedProjectionId);
        verify(identityStore).recordIndexed(List.of("repo-001"));
    }

    @Test
    void refusesToFinishWhenOneSourceCannotSatisfyItsCompositionQuota() {
        RepositoryCatalog repositoryCatalog = mock(RepositoryCatalog.class);
        CombinedDiscoveryCatalog combinedCatalog = mock(CombinedDiscoveryCatalog.class);
        RepositoryIdentityStore identityStore = mock(RepositoryIdentityStore.class);
        RecordingTarget target = new RecordingTarget("discovery");
        DiscoveryDocument dataGov =
                document("DATA_GOV:001", ResearchObjectOrigin.FEDERATED, SourceSystem.DATA_GOV);
        FederatedCompositeCorpusManifest composition = composition(2, 2);

        when(repositoryCatalog.findAllDiscoveryDocuments()).thenReturn(List.of());
        when(combinedCatalog.findFederatedAfter(eq(FederatedSourceSystem.DATA_GOV), isNull(), eq(2)))
                .thenReturn(new FederatedDiscoveryPage(List.of(dataGov), "DATA_GOV:001", true));

        DiscoveryProjectionService service = new DiscoveryProjectionService(
                repositoryCatalog, combinedCatalog, List.of(target), identityStore);

        assertThatThrownBy(() -> service.reindex(composition))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("exhausted source DATA_GOV")
                .hasMessageContaining("required 2");
        assertThat(target.completed).isFalse();
        assertThat(target.aborted).isTrue();
    }

    private FederatedCompositeCorpusManifest composition(long dataCount, long ostiCount) {
        OffsetDateTime capturedAt = OffsetDateTime.parse("2026-08-31T20:00:00Z");
        return new FederatedCompositeCorpusManifest(
                "federated-composition/v1",
                FederatedCompositeCorpusManifest.MODE,
                CorpusProfile.FEDERATED_1M,
                List.of(
                        source(FederatedSourceSystem.DATA_GOV, dataCount, "a".repeat(64), capturedAt),
                        source(FederatedSourceSystem.DOE_OSTI, ostiCount, "b".repeat(64), capturedAt)),
                dataCount + ostiCount,
                "c".repeat(64),
                capturedAt);
    }

    private FederatedCompositeCorpusSource source(
            FederatedSourceSystem sourceSystem,
            long count,
            String sha,
            OffsetDateTime capturedAt) {
        return new FederatedCompositeCorpusSource(
                sourceSystem,
                count,
                sourceSystem.name() + ":" + sha,
                sourceSystem.name().toLowerCase() + "-run",
                "adapter-v1",
                List.of("adapter-v1"),
                count,
                sha,
                capturedAt);
    }

    private DiscoveryDocument document(String id, ResearchObjectOrigin origin, SourceSystem sourceSystem) {
        SearchResult result = new SearchResult(
                id,
                "Title " + id,
                origin == ResearchObjectOrigin.REPOSITORY
                        ? ResearchObjectType.DATASET
                        : ResearchObjectType.PUBLICATION,
                ResearchProgram.OTHER,
                "Publisher",
                "Summary",
                URI.create("https://example.gov/" + id.replace(':', '/')),
                origin,
                sourceSystem);
        return DiscoveryDocument.of(result);
    }

    private static final class RecordingTarget implements DiscoveryProjectionTarget {
        private final String indexName;
        private final List<List<DiscoveryDocument>> batches = new ArrayList<>();
        private boolean completed;
        private boolean aborted;
        private int count;

        private RecordingTarget(String indexName) {
            this.indexName = indexName;
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
            count = 0;
            completed = false;
            aborted = false;
        }

        @Override
        public void indexBatch(List<DiscoveryDocument> objects) {
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
