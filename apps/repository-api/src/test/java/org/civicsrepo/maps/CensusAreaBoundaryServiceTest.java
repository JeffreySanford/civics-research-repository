package org.civicsrepo.maps;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class CensusAreaBoundaryServiceTest {
    private final CensusAreaBoundaryService service = new CensusAreaBoundaryService();

    @Test
    void listsSelectableCensusAreasBeyondNorthDakota() {
        assertThat(service.listBoundaries())
                .hasSize(52)
                .extracting(CensusAreaBoundary::geography)
                .contains("North Dakota", "California", "Texas", "Puerto Rico", "District of Columbia");
    }

    @Test
    void boundariesIncludeUsableMapExtents() {
        CensusAreaBoundary california = service.listBoundaries().stream()
                .filter(boundary -> boundary.geography().equals("California"))
                .findFirst()
                .orElseThrow();

        assertThat(california.west()).isLessThan(california.east());
        assertThat(california.south()).isLessThan(california.north());
        assertThat(california.centerLatitude()).isBetween(california.south(), california.north());
        assertThat(california.centerLongitude()).isBetween(california.west(), california.east());
        assertThat(california.defaultZoom()).isGreaterThan(0);
    }
}
