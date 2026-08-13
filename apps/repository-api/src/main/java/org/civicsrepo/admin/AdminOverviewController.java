package org.civicsrepo.admin;

import org.civicsrepo.generated.dto.DspaceOverview;
import org.civicsrepo.generated.dto.SolrOverview;
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

    public AdminOverviewController(AdminOverviewService adminOverviewService) {
        this.adminOverviewService = adminOverviewService;
    }

    @GetMapping("/dspace/overview")
    public DspaceOverview dspaceOverview() {
        return adminOverviewService.dspaceOverview();
    }

    @GetMapping("/solr/overview")
    public SolrOverview solrOverview() {
        return adminOverviewService.solrOverview();
    }
}
