package org.civicsrepo.sources;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import org.civicsrepo.generated.dto.AccessLevel;
import org.civicsrepo.generated.dto.ResearchObjectType;
import org.civicsrepo.generated.dto.ResearchProgram;
import org.junit.jupiter.api.Test;

class CatalogMetadataReaderTest {
    private final CatalogMetadataReader reader = new CatalogMetadataReader();

    @Test
    void restrictedCatalogObjectPreservesAccessSemantics() {
        ResearchObjectMetadata restricted = object("lehd-microdata-restricted");

        assertThat(restricted.contentType()).isEqualTo(ResearchObjectType.DATASET);
        assertThat(restricted.accessLevel()).isEqualTo(AccessLevel.RESTRICTED);
        assertThat(restricted.accessNote()).contains("Federal Statistical Research Data Center");
        assertThat(restricted.files()).isEmpty();
        assertThat(restricted.accessGuidance()).isNotNull();
        assertThat(restricted.accessGuidance().mechanism()).isEqualTo("FSRDC");
        assertThat(restricted.accessGuidance().accessUrl())
                .isEqualTo("https://www.census.gov/about/adrm/fsrdc.html");
        assertThat(restricted.accessGuidance().restrictionBasis()).isEqualTo("Title 13, U.S. Code");
    }

    @Test
    void publicationCatalogObjectPreservesResearchSemantics() {
        ResearchObjectMetadata publication = object("ces-wp-25-23-spatial-mismatch");

        assertThat(publication.contentType()).isEqualTo(ResearchObjectType.PUBLICATION);
        assertThat(publication.accessLevel()).isEqualTo(AccessLevel.PUBLIC);
        assertThat(publication.doi()).isEqualTo("10.3386/w32252");
        assertThat(publication.authors())
                .extracting(ResearchObjectMetadata.ResearchAuthorMetadata::name)
                .containsExactly("David Card", "Jesse Rothstein", "Moises Yi");
        assertThat(publication.relations())
                .extracting(ResearchObjectMetadata.ResearchObjectRelation::targetId)
                .containsExactly(
                        "lodes-wac-north-dakota-2023", "lehd-microdata-restricted");
    }

    @Test
    void invalidReleaseDateRemainsUnknown() {
        CatalogMetadataReader invalidDateReader =
                new CatalogMetadataReader("/catalog-metadata-reader-invalid-date.json");

        List<ResearchObjectMetadata> objects = invalidDateReader.forProgram(ResearchProgram.CPS);

        assertThat(objects).hasSize(1);
        assertThat(objects.getFirst().releasedOn()).isNull();
    }

    private ResearchObjectMetadata object(String id) {
        return reader.forProgram(ResearchProgram.LEHD).stream()
                .filter((item) -> item.id().equals(id))
                .findFirst()
                .orElseThrow(() -> new AssertionError("Missing catalog object " + id));
    }
}
