package org.civicsrepo.admin;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.civicsrepo.dspace.DspaceRestClient;
import org.civicsrepo.generated.dto.DspaceContainerSummary;
import org.civicsrepo.generated.dto.DspaceOverview;
import org.civicsrepo.generated.dto.ProgramCount;
import org.civicsrepo.generated.dto.ProjectionBreakdown;
import org.civicsrepo.generated.dto.ResearchProgram;
import org.civicsrepo.generated.dto.SolrOverview;
import org.civicsrepo.generated.dto.SyncAction;
import org.civicsrepo.generated.dto.SyncActionSummary;
import org.civicsrepo.generated.dto.SyncJob;
import org.civicsrepo.generated.dto.SyncSource;
import org.civicsrepo.repository.DiscoveryProjectionService;
import org.civicsrepo.repository.DiscoveryProjectionService.ProjectionState;
import org.civicsrepo.search.DiscoveryIndex;
import org.civicsrepo.sync.SyncService;
import org.springframework.stereotype.Service;

@Service
public class AdminOverviewService {
    private static final List<String> STORED_METADATA_FIELDS = List.of(
            "dc.title",
            "dc.description",
            "dc.date.issued",
            "crr.program",
            "crr.geography",
            "crr.file.manifest",
            "crr.releaseDate",
            "crr.sourceUrl");

    private final DspaceRestClient dspaceRestClient;
    private final DiscoveryIndex discoveryIndex;
    private final DiscoveryProjectionService discoveryProjectionService;
    private final SyncService syncService;

    public AdminOverviewService(
            DspaceRestClient dspaceRestClient,
            DiscoveryIndex discoveryIndex,
            DiscoveryProjectionService discoveryProjectionService,
            SyncService syncService) {
        this.dspaceRestClient = dspaceRestClient;
        this.discoveryIndex = discoveryIndex;
        this.discoveryProjectionService = discoveryProjectionService;
        this.syncService = syncService;
    }

    public DspaceOverview dspaceOverview() {
        DspaceOverview overview = new DspaceOverview(
                dspaceRestClient.isReachable(),
                dspaceRestClient.isReadEnabled(),
                dspaceRestClient.isWriteEnabled());

        overview.storedMetadataFields(STORED_METADATA_FIELDS);

        List<SyncJob> recentJobs = syncService.findRecentJobs();
        overview.recentSyncActionSummary(summarizeRecentActions(recentJobs));

        if (!dspaceRestClient.isReadEnabled()) {
            return overview
                    .statusMessage(
                            "DSpace reads are disabled. Set CIVICS_DSPACE_BASE_URL to enable repository stats.")
                    .programCounts(programCountsFromJobs(recentJobs));
        }

        if (!dspaceRestClient.baseUrl().isBlank()) {
            overview.baseUrl(dspaceRestClient.baseUrl());
        }

        if (!overview.getReachable()) {
            return overview
                    .statusMessage(
                            "DSpace REST is not reachable. Start the dspace-rest profile and run pnpm run dspace:seed.")
                    .programCounts(programCountsFromJobs(recentJobs));
        }

        List<DspaceRestClient.ContainerSummary> communities = dspaceRestClient.listCommunities();
        List<DspaceRestClient.ContainerSummary> collections = dspaceRestClient.listCollections();
        overview
                .communityCount(communities.size())
                .collectionCount(collections.size())
                .communities(communities.stream().map(this::toContainerSummary).toList())
                .collections(collections.stream().map(this::toContainerSummary).toList());

        dspaceRestClient.countDiscoverableItems().ifPresent(overview::itemCount);
        dspaceRestClient.summarizeStoredBitstreams().ifPresent((stored) -> overview
                .storedBitstreamCount(stored.fileCount())
                .storedBytes(stored.totalBytes()));

        Optional<SyncJob> latestJob = recentJobs.stream().findFirst();
        latestJob.ifPresent((job) -> overview
                .lastSyncStatus(job.getStatus())
                .lastSyncSource(job.getSource())
                .lastSyncStartedAt(job.getStartedAt()));

        overview.programCounts(resolveProgramCounts(recentJobs));

        return overview;
    }

    public SolrOverview solrOverview() {
        SolrOverview overview =
                new SolrOverview(discoveryIndex.isEnabled(), discoveryIndex.isReachable());

        if (!discoveryIndex.isEnabled()) {
            return overview.statusMessage(
                    "Discovery Solr is disabled. Set CIVICS_SOLR_BASE_URL to enable indexed document counts.");
        }

        if (!discoveryIndex.baseUrl().isBlank()) {
            overview.baseUrl(discoveryIndex.baseUrl());
        }
        if (!discoveryIndex.indexName().isBlank()) {
            overview.core(discoveryIndex.indexName());
        }

        Optional<Integer> indexedCount = discoveryIndex.documentCount();
        indexedCount.ifPresent(overview::indexedDocumentCount);

        ProjectionState projection = discoveryProjectionService.state();
        overview
                .projectionSource(projection.source())
                .projectionObjectCount(projection.objectCount())
                .lastRebuiltAt(projection.rebuiltAt());

        Optional<Integer> repositoryItemCount =
                dspaceRestClient.isReadEnabled() && dspaceRestClient.isReachable()
                        ? dspaceRestClient.countDiscoverableItems()
                        : Optional.empty();

        ProjectionBreakdown breakdown = new ProjectionBreakdown(
                        indexedCount.orElse(0),
                        projection.objectCount(),
                        projection.source())
                .repositoryItemCount(repositoryItemCount.orElse(null));
        overview.projectionBreakdown(breakdown);

        if (!overview.getReachable()) {
            overview.statusMessage(
                    "Discovery Solr is not reachable on port 8983. Projection metadata may still reflect the last"
                            + " in-memory rebuild.");
        }

        return overview;
    }

    private List<ProgramCount> resolveProgramCounts(List<SyncJob> recentJobs) {
        Map<ResearchProgram, Integer> solrCounts = discoveryIndex.programFacetCounts();
        if (!solrCounts.isEmpty()) {
            return solrCounts.entrySet().stream()
                    .sorted(Comparator.comparing((entry) -> entry.getKey().getValue()))
                    .map((entry) -> new ProgramCount(entry.getKey(), entry.getValue()))
                    .toList();
        }
        return programCountsFromJobs(recentJobs);
    }

    private List<ProgramCount> programCountsFromJobs(List<SyncJob> recentJobs) {
        Map<ResearchProgram, Integer> counts = new LinkedHashMap<>();
        for (SyncJob job : recentJobs) {
            if (job.getSource() != null) {
                counts.merge(toResearchProgram(job.getSource()), 1, Integer::sum);
            }
        }
        return counts.entrySet().stream()
                .sorted(Comparator.comparing((entry) -> entry.getKey().getValue()))
                .map((entry) -> new ProgramCount(entry.getKey(), entry.getValue()))
                .toList();
    }

    private ResearchProgram toResearchProgram(SyncSource source) {
        return switch (source) {
            case TIGER_LINE -> ResearchProgram.TIGER_LINE;
            case LODES -> ResearchProgram.LODES;
            case ACS_PUMS -> ResearchProgram.ACS;
            case SIPP -> ResearchProgram.SIPP;
            case CPS -> ResearchProgram.CPS;
            case USGS_EARTHQUAKES -> ResearchProgram.USGS;
        };
    }

    private List<SyncActionSummary> summarizeRecentActions(List<SyncJob> recentJobs) {
        Map<String, Integer> counts = new LinkedHashMap<>();
        for (SyncJob job : recentJobs) {
            for (SyncAction action : job.getActions()) {
                String actionType =
                        action.getActionType() == null ? "UNKNOWN" : action.getActionType().getValue();
                counts.merge(actionType, 1, Integer::sum);
            }
        }
        List<SyncActionSummary> summaries = new ArrayList<>();
        counts.forEach((actionType, count) -> summaries.add(new SyncActionSummary(actionType, count)));
        summaries.sort(Comparator.comparing(SyncActionSummary::getActionType));
        return summaries;
    }

    private DspaceContainerSummary toContainerSummary(DspaceRestClient.ContainerSummary container) {
        DspaceContainerSummary summary = new DspaceContainerSummary(container.name());
        if (container.uuid() != null && !container.uuid().isBlank()) {
            summary.uuid(java.util.UUID.fromString(container.uuid()));
        }
        return summary;
    }
}
