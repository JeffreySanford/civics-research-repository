package org.civicsrepo.repository;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import org.civicsrepo.repository.FixtureCatalog;
import org.civicsrepo.search.DiscoveryDocument;
import org.junit.jupiter.api.Test;

class DiscoveryProjectionDigestTest {
    @Test
    void batchBoundariesDoNotChangeProjectionIdentity() {
        List<DiscoveryDocument> documents = new FixtureCatalog().discoveryDocuments().subList(0, 3);

        DiscoveryProjectionDigest singleBatch = new DiscoveryProjectionDigest();
        singleBatch.updateBatch(documents);

        DiscoveryProjectionDigest severalBatches = new DiscoveryProjectionDigest();
        severalBatches.updateBatch(documents.subList(0, 1));
        severalBatches.updateBatch(documents.subList(1, 2));
        severalBatches.updateBatch(documents.subList(2, 3));

        assertThat(singleBatch.documentCount()).isEqualTo(3);
        assertThat(severalBatches.documentCount()).isEqualTo(3);
        assertThat(singleBatch.finish()).isEqualTo(severalBatches.finish());
    }

    @Test
    void recordOrderRemainsPartOfTheVersionedIdentity() {
        List<DiscoveryDocument> documents = new FixtureCatalog().discoveryDocuments().subList(0, 3);
        List<DiscoveryDocument> reversed = new ArrayList<>(documents);
        Collections.reverse(reversed);

        DiscoveryProjectionDigest forward = new DiscoveryProjectionDigest();
        forward.updateBatch(documents);
        DiscoveryProjectionDigest backward = new DiscoveryProjectionDigest();
        backward.updateBatch(reversed);

        assertThat(forward.finish()).isNotEqualTo(backward.finish());
    }

    @Test
    void digestCannotBeReusedAfterFinishing() {
        DiscoveryProjectionDigest digest = new DiscoveryProjectionDigest();
        digest.update(new FixtureCatalog().discoveryDocuments().getFirst());
        digest.finish();

        assertThatThrownBy(() -> digest.update(new FixtureCatalog().discoveryDocuments().get(1)))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("finished");
    }
}
