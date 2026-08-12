package org.civicsrepo.maps;

import static org.assertj.core.api.Assertions.assertThat;

import org.civicsrepo.generated.dto.CensusAreaBoundary;
import org.junit.jupiter.api.Test;

class CensusAreaBoundaryServiceTest {
    private final CensusAreaBoundaryService service = new CensusAreaBoundaryService();

    @Test
    void listsSelectableCensusAreasBeyondNorthDakota() {
        assertThat(service.listBoundaries())
                .hasSize(52)
                .extracting(CensusAreaBoundary::getGeography)
                .contains("North Dakota", "California", "Texas", "Puerto Rico", "District of Columbia");
    }

    @Test
    void boundariesIncludeUsableMapExtents() {
        CensusAreaBoundary california = service.listBoundaries().stream()
                .filter(boundary -> boundary.getGeography().equals("California"))
                .findFirst()
                .orElseThrow();

        assertThat(california.getWest()).isLessThan(california.getEast());
        assertThat(california.getSouth()).isLessThan(california.getNorth());
        assertThat(california.getCenterLatitude()).isBetween(california.getSouth(), california.getNorth());
        assertThat(california.getCenterLongitude()).isBetween(california.getWest(), california.getEast());
        assertThat(california.getDefaultZoom()).isGreaterThan(0);
    }
}
