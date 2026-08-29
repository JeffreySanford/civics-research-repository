package org.civicsrepo.admin;

import java.util.List;
import org.civicsrepo.generated.dto.CorpusStorageMeasurement;
import org.civicsrepo.generated.dto.CorpusStorageOverview;
import org.civicsrepo.generated.dto.DspaceOverview;
import org.civicsrepo.generated.dto.RepositoryIdentityRecord;
import org.civicsrepo.generated.dto.RepositoryIdentitySummary;
import org.civicsrepo.generated.dto.SolrOverview;
import org.civicsrepo.generated.dto.SourceInventory;
import org.civicsrepo.repository.RepositoryIdentity;
import org.civicsrepo.repository.RepositoryIdentityStore;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Admin overview endpoints for repository/search education plus live operational evidence.
 *
 * <p>Unauthenticated for the same deliberate local-demo reasons as sync endpoints; see
 * planning/DECISIONS.md under "Admin API Authentication".
 */
@RestController
@RequestMapping("/admin")
public class AdminOverviewController {
    private final AdminOverviewService adminOverviewService;
    private final CorpusStorageAdminService corpusStorageAdminService;
    private final RepositoryIdentityStore repositoryIdentityStore;
    private final SourceInventoryService sourceInventoryService;

    public AdminOverviewController(
            AdminOverviewService adminOverviewService,
            CorpusStorageAdminService corpusStorageAdminService,
            SourceInventoryService sourceInventoryService,
            RepositoryIdentityStore repositoryIdentityStore) {
        this.repositoryIdentityStore = repositoryIdentityStore;
        this.adminOverviewService = adminOverviewService;
        this.corpusStorageAdminService = corpusStorageAdminService;
        this.sourceInventoryService = sourceInventoryService;
    }

    @GetMapping("/dspace/overview")
    public DspaceOverview dspaceOverview() {
        return adminOverviewService.dspaceOverview();
    }

    @GetMapping("/corpus/storage")
    public CorpusStorageOverview corpusStorageOverview() {
        return corpusStorageAdminService.overview();
    }

    @PostMapping("/corpus/storage/capture")
    public CorpusStorageMeasurement captureCorpusStorage() {
        return corpusStorageAdminService.captureCurrent();
    }

    @GetMapping("/solr/overview")
    public SolrOverview solrOverview() {
        return adminOverviewService.solrOverview();
    }

    /**
     * What the repository is subscribed to, as opposed to what it holds.
     *
     * <p>Measured out of band and served from a committed artifact; see {@link
     * SourceInventoryService}.
     */
    @GetMapping("/repository/identity")
    public RepositoryIdentitySummary repositoryIdentity() {
        List<RepositoryIdentity> identities = repositoryIdentityStore.findAll();

        RepositoryIdentitySummary summary = new RepositoryIdentitySummary(
                identities.size(),
                repositoryIdentityStore.countWithDspaceUuid(),
                (int) identities.stream()
                        .filter((identity) -> identity.indexedAt() != null)
                        .count());

        // A handful of examples rather than all 181: this endpoint answers "does the chain reach",
        // and a reader checking that does not need the whole table to believe it.
        summary.setExamples(identities.stream()
                .filter((identity) -> identity.dspaceUuid() != null)
                .limit(5)
                .map((identity) -> {
                    RepositoryIdentityRecord record = new RepositoryIdentityRecord(identity.sourceIdentifier());
                    record.setDspaceUuid(identity.dspaceUuid());
                    record.setSourceUrl(identity.sourceUrl());
                    record.setIndexedAt(identity.indexedAt());
                    return record;
                })
                .toList());

        return summary;
    }

    @GetMapping("/sources/inventory")
    public SourceInventory sourceInventory() {
        return sourceInventoryService.inventory();
    }
}
