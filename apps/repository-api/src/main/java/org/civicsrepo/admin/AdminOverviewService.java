package org.civicsrepo.admin;

import java.util.List;
import java.util.Optional;
import org.civicsrepo.dspace.DspaceRestClient;
import org.civicsrepo.generated.dto.DspaceContainerSummary;
import org.civicsrepo.generated.dto.DspaceOverview;
import org.civicsrepo.generated.dto.SolrOverview;
import org.civicsrepo.generated.dto.SyncJob;
import org.civicsrepo.repository.DiscoveryProjectionService;
import org.civicsrepo.repository.DiscoveryProjectionService.ProjectionState;
import org.civicsrepo.search.SolrSearchClient;
import org.civicsrepo.sync.SyncService;
import org.springframework.stereotype.Service;

@Service
public class AdminOverviewService {
    private final DspaceRestClient dspaceRestClient;
    private final SolrSearchClient solrSearchClient;
    private final DiscoveryProjectionService discoveryProjectionService;
    private final SyncService syncService;

    public AdminOverviewService(
            DspaceRestClient dspaceRestClient,
            SolrSearchClient solrSearchClient,
            DiscoveryProjectionService discoveryProjectionService,
            SyncService syncService) {
        this.dspaceRestClient = dspaceRestClient;
        this.solrSearchClient = solrSearchClient;
        this.discoveryProjectionService = discoveryProjectionService;
        this.syncService = syncService;
    }

    public DspaceOverview dspaceOverview() {
        DspaceOverview overview = new DspaceOverview(
                dspaceRestClient.isReachable(),
                dspaceRestClient.isReadEnabled(),
                dspaceRestClient.isWriteEnabled());

        if (!dspaceRestClient.isReadEnabled()) {
            return overview.statusMessage(
                    "DSpace reads are disabled. Set CIVICS_DSPACE_BASE_URL to enable repository stats.");
        }

        if (!dspaceRestClient.baseUrl().isBlank()) {
            overview.baseUrl(dspaceRestClient.baseUrl());
        }

        if (!overview.getReachable()) {
            return overview.statusMessage(
                    "DSpace REST is not reachable. Start the dspace-rest profile and run pnpm run dspace:seed.");
        }

        List<DspaceRestClient.ContainerSummary> communities = dspaceRestClient.listCommunities();
        List<DspaceRestClient.ContainerSummary> collections = dspaceRestClient.listCollections();
        overview
                .communityCount(communities.size())
                .collectionCount(collections.size())
                .communities(communities.stream().map(this::toContainerSummary).toList())
                .collections(collections.stream().map(this::toContainerSummary).toList());

        dspaceRestClient.countDiscoverableItems().ifPresent(overview::itemCount);

        Optional<SyncJob> latestJob = syncService.findRecentJobs().stream().findFirst();
        latestJob.ifPresent((job) -> overview
                .lastSyncStatus(job.getStatus())
                .lastSyncSource(job.getSource())
                .lastSyncStartedAt(job.getStartedAt()));

        return overview;
    }

    public SolrOverview solrOverview() {
        SolrOverview overview =
                new SolrOverview(solrSearchClient.isEnabled(), solrSearchClient.isReachable());

        if (!solrSearchClient.isEnabled()) {
            return overview.statusMessage(
                    "Discovery Solr is disabled. Set CIVICS_SOLR_BASE_URL to enable indexed document counts.");
        }

        if (!solrSearchClient.baseUrl().isBlank()) {
            overview.baseUrl(solrSearchClient.baseUrl());
        }
        if (!solrSearchClient.coreName().isBlank()) {
            overview.core(solrSearchClient.coreName());
        }

        solrSearchClient.documentCount().ifPresent(overview::indexedDocumentCount);

        ProjectionState projection = discoveryProjectionService.state();
        overview
                .projectionSource(projection.source())
                .projectionObjectCount(projection.objectCount())
                .lastRebuiltAt(projection.rebuiltAt());

        if (!overview.getReachable()) {
            overview.statusMessage(
                    "Discovery Solr is not reachable on port 8983. Projection metadata may still reflect the last"
                            + " in-memory rebuild.");
        }

        return overview;
    }

    private DspaceContainerSummary toContainerSummary(DspaceRestClient.ContainerSummary container) {
        DspaceContainerSummary summary = new DspaceContainerSummary(container.name());
        if (container.uuid() != null && !container.uuid().isBlank()) {
            summary.uuid(java.util.UUID.fromString(container.uuid()));
        }
        return summary;
    }
}
