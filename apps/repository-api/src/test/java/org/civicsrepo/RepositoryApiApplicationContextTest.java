package org.civicsrepo;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.civicsrepo.datasets.DatasetController;
import org.civicsrepo.dspace.DspaceItemDiffPlanner;
import org.civicsrepo.dspace.DspaceItemStateReader;
import org.civicsrepo.dspace.DspaceItemWriteGateway;
import org.civicsrepo.dspace.DspaceRestClient;
import org.civicsrepo.evidence.AccessibilityEvidenceController;
import org.civicsrepo.maps.MapsController;
import org.civicsrepo.search.SearchController;
import org.civicsrepo.search.SolrSearchClient;
import org.civicsrepo.sync.SyncController;
import org.civicsrepo.sync.SyncJobStore;
import org.civicsrepo.sync.SyncProperties;
import org.civicsrepo.sync.SyncService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.ApplicationContext;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;

/**
 * Loads the real application context.
 *
 * <p>Every other test in this module is a unit test, which means bean wiring, {@code @Value}
 * binding, {@code @ConfigurationProperties} binding, and request-mapping registration were
 * previously only exercised when the Compose stack started. This test moves that failure mode into
 * {@code nx run repository-api:test}.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class RepositoryApiApplicationContextTest {
    @Autowired
    private ApplicationContext applicationContext;

    @Autowired
    private MockMvc mockMvc;

    @Test
    void contextLoadsWithEveryControllerAndGatewayWired() {
        assertThat(applicationContext.getBean(DatasetController.class)).isNotNull();
        assertThat(applicationContext.getBean(MapsController.class)).isNotNull();
        assertThat(applicationContext.getBean(SearchController.class)).isNotNull();
        assertThat(applicationContext.getBean(SyncController.class)).isNotNull();
        assertThat(applicationContext.getBean(AccessibilityEvidenceController.class)).isNotNull();
        assertThat(applicationContext.getBean(SyncService.class)).isNotNull();
        assertThat(applicationContext.getBean(SyncJobStore.class)).isNotNull();
        assertThat(applicationContext.getBean(DspaceItemDiffPlanner.class)).isNotNull();
        assertThat(applicationContext.getBean(DspaceRestClient.class)).isNotNull();
    }

    @Test
    void resolvesExactlyOneImplementationForEachDspaceCollaborator() {
        assertThat(applicationContext.getBeanNamesForType(DspaceItemStateReader.class)).hasSize(1);
        assertThat(applicationContext.getBeanNamesForType(DspaceItemWriteGateway.class)).hasSize(1);
    }

    @Test
    void bindsSyncConfigurationProperties() {
        SyncProperties syncProperties = applicationContext.getBean(SyncProperties.class);

        assertThat(syncProperties.startupEnabled()).isFalse();
        assertThat(syncProperties.cliEnabled()).isFalse();
        assertThat(syncProperties.mode()).isNotNull();
        assertThat(syncProperties.source()).isNotNull();
    }

    /** Blank credentials must disable DSpace writes rather than authenticating with a built-in default. */
    @Test
    void leavesDspaceIntegrationDisabledWhenNoCredentialsAreConfigured() {
        DspaceRestClient dspaceRestClient = applicationContext.getBean(DspaceRestClient.class);

        assertThat(dspaceRestClient.isReadEnabled()).isFalse();
        assertThat(dspaceRestClient.isWriteEnabled()).isFalse();
        assertThat(applicationContext.getBean(SolrSearchClient.class).isEnabled()).isFalse();
    }

    @Test
    void exposesHealthThroughTheRegisteredRequestMappings() throws Exception {
        mockMvc.perform(get("/health"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("UP"))
                .andExpect(jsonPath("$.service").value("repository-api"));
    }
}
