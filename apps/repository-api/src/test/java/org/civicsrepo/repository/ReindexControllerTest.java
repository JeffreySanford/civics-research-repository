package org.civicsrepo.repository;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.OffsetDateTime;
import java.util.List;
import org.civicsrepo.generated.dto.RepositorySource;
import org.civicsrepo.repository.DiscoveryProjectionService.ProjectionState;
import org.civicsrepo.search.SearchService;
import org.junit.jupiter.api.Test;

class ReindexControllerTest {
    private static final String PROJECTION_ID =
            "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

    @Test
    void projectionStateIncludesTheCurrentDeterministicProjectionIdentity() {
        DiscoveryProjectionService projectionService = mock(DiscoveryProjectionService.class);
        SearchService searchService = mock(SearchService.class);
        OffsetDateTime rebuiltAt = OffsetDateTime.parse("2026-08-29T13:03:07-05:00");
        when(projectionService.state()).thenReturn(new ProjectionState(RepositorySource.REPOSITORY, 181, rebuiltAt));
        when(projectionService.currentProjectionId()).thenReturn(PROJECTION_ID);
        ReindexController controller = new ReindexController(projectionService, searchService);

        var response = controller.projectionState();

        assertThat(response.getSource()).isEqualTo(RepositorySource.REPOSITORY);
        assertThat(response.getObjectCount()).isEqualTo(181);
        assertThat(response.getRebuiltAt()).isEqualTo(rebuiltAt);
        assertThat(response.getProjectionId()).isEqualTo(PROJECTION_ID);
    }

    @Test
    void reindexReturnsTheGeneratedContractStateAfterRebuildingAllTargets() {
        DiscoveryProjectionService projectionService = mock(DiscoveryProjectionService.class);
        SearchService searchService = mock(SearchService.class);
        OffsetDateTime rebuiltAt = OffsetDateTime.parse("2026-08-29T13:05:00-05:00");
        when(searchService.fixtureDocuments()).thenReturn(List.of());
        when(projectionService.reindex(List.of()))
                .thenReturn(new ProjectionState(RepositorySource.FIXTURE, 181, rebuiltAt));
        when(projectionService.currentProjectionId()).thenReturn(PROJECTION_ID);
        ReindexController controller = new ReindexController(projectionService, searchService);

        var response = controller.reindex();

        assertThat(response.getSource()).isEqualTo(RepositorySource.FIXTURE);
        assertThat(response.getObjectCount()).isEqualTo(181);
        assertThat(response.getProjectionId()).isEqualTo(PROJECTION_ID);
        verify(projectionService).reindex(List.of());
    }
}
