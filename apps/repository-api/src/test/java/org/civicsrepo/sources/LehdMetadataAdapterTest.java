package org.civicsrepo.sources;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import org.civicsrepo.generated.dto.AccessLevel;
import org.civicsrepo.generated.dto.ResearchProgram;
import org.civicsrepo.generated.dto.SyncSource;
import org.junit.jupiter.api.Test;

class LehdMetadataAdapterTest {

    private final CatalogMetadataReader catalogMetadataReader =
            new CatalogMetadataReader();

    @Test
    void exposesRestrictedLehdMetadataAsItsOwnSyncSource() {
        LehdMetadataAdapter adapter =
                new LehdMetadataAdapter(catalogMetadataReader);

        assertThat(adapter.source()).isEqualTo(SyncSource.LEHD);

        List<ResearchObjectMetadata> objects = adapter.harvest();

        assertThat(objects)
                .extracting(ResearchObjectMetadata::id)
                .contains("lehd-microdata-restricted");

        ResearchObjectMetadata restricted = objects.stream()
                .filter(object -> object.id().equals("lehd-microdata-restricted"))
                .findFirst()
                .orElseThrow();

        assertThat(restricted.program()).isEqualTo(ResearchProgram.LEHD);
        assertThat(restricted.accessLevel()).isEqualTo(AccessLevel.RESTRICTED);
        assertThat(restricted.files()).isEmpty();

        assertThat(restricted.accessGuidance()).isNotNull();
        assertThat(restricted.accessGuidance().mechanism()).isEqualTo("FSRDC");
        assertThat(restricted.accessGuidance().accessUrl())
                .isEqualTo("https://www.census.gov/about/adrm/fsrdc.html");
        assertThat(restricted.accessGuidance().instructions())
                .isEqualTo(
                        "Access requires an approved research proposal and Special Sworn Status through a Federal Statistical Research Data Center.");
        assertThat(restricted.accessGuidance().restrictionBasis())
                .isEqualTo("Title 13, U.S. Code");
    }
}
