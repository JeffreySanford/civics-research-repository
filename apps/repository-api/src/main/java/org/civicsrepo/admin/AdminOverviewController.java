package org.civicsrepo.admin;

import org.civicsrepo.generated.dto.DspaceOverview;
import org.civicsrepo.generated.dto.SolrOverview;
import org.civicsrepo.generated.dto.SourceInventory;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Admin overview endpoints for DSpace and Solr education plus live stats.
 *
 * <p>Unauthenticated for the same deliberate local-demo reasons as sync endpoints; see
 * planning/DECISIONS.md under "Admin API Authentication".
 */
@RestController
@RequestMapping("/admin")
public class AdminOverviewController {
    private final AdminOverviewService adminOverviewService;
    private final SourceInventoryService sourceInventoryService;

    public AdminOverviewController(
            AdminOverviewService adminOverviewService, SourceInventoryService sourceInventoryService) {
        this.adminOverviewService = adminOverviewService;
        this.sourceInventoryService = sourceInventoryService;
    }

    @GetMapping("/dspace/overview")
    public DspaceOverview dspaceOverview() {
        return adminOverviewService.dspaceOverview();
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
    @GetMapping("/sources/inventory")
    public SourceInventory sourceInventory() {
        return sourceInventoryService.inventory();
    }
}
