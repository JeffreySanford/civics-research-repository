package org.civicsrepo.repository;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class FixtureCatalogTest {
    @Test
    void exposesRestrictedAccessProfileInputsWithoutSyntheticFiles() {
        var detail = new FixtureCatalog()
                .findDataset("lehd-microdata-restricted")
                .orElseThrow();

        assertThat(detail.getDocumentationUrl())
                .hasToString("https://www.census.gov/about/adrm/fsrdc.html");
        assertThat(detail.getGeographicLevel()).isEqualTo("National");
        assertThat(detail.getSubjects())
                .containsExactly("LEHD", "Restricted use", "Title 13", "Administrative records");
        assertThat(detail.getFiles()).isEmpty();

        assertThat(detail.getAccessGuidance()).isNotNull();
        assertThat(detail.getAccessGuidance().getMechanism()).isEqualTo("FSRDC");
        assertThat(detail.getAccessGuidance().getAccessUrl())
                .hasToString("https://www.census.gov/about/adrm/fsrdc.html");
        assertThat(detail.getAccessGuidance().getInstructions())
                .isEqualTo(
                        "Access requires an approved research proposal and Special Sworn Status through a Federal Statistical Research Data Center.");
        assertThat(detail.getAccessGuidance().getRestrictionBasis())
                .isEqualTo("Title 13, U.S. Code");
    }
}
