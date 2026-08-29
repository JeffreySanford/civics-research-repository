package org.civicsrepo.repository;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import org.civicsrepo.search.DiscoveryDocument;
import org.junit.jupiter.api.Test;

class DiscoveryProjectionFingerprintTest {

    @Test
    void fingerprintIgnoresRepositoryReadOrder() {
        List<DiscoveryDocument> documents = new ArrayList<>(new FixtureCatalog().discoveryDocuments());
        String forward = DiscoveryProjectionFingerprint.fingerprint(documents);

        Collections.reverse(documents);

        assertThat(DiscoveryProjectionFingerprint.fingerprint(documents)).isEqualTo(forward);
    }

    @Test
    void fingerprintChangesWhenProjectionContentChanges() {
        List<DiscoveryDocument> documents = new FixtureCatalog().discoveryDocuments();
        String complete = DiscoveryProjectionFingerprint.fingerprint(documents);
        String missingOne = DiscoveryProjectionFingerprint.fingerprint(documents.subList(1, documents.size()));

        assertThat(missingOne).isNotEqualTo(complete);
    }

    @Test
    void fingerprintIsSha256Hex() {
        String fingerprint = DiscoveryProjectionFingerprint.fingerprint(new FixtureCatalog().discoveryDocuments());

        assertThat(fingerprint).matches("[0-9a-f]{64}");
    }
}
