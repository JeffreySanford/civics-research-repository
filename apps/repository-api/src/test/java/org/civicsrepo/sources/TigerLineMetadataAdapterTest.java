package org.civicsrepo.sources;

import org.civicsrepo.generated.dto.ResearchProgram;
import static org.assertj.core.api.Assertions.assertThat;

import java.time.LocalDate;
import org.civicsrepo.datasets.FileFormat;
import org.civicsrepo.sync.SyncSource;
import org.junit.jupiter.api.Test;

class TigerLineMetadataAdapterTest {
    @Test
    void normalizesNorthDakotaTractMetadata() {
        TigerLineMetadataAdapter adapter = new TigerLineMetadataAdapter();

        PublicDatasetMetadata metadata = adapter.firstVisualSlice();

        assertThat(adapter.source()).isEqualTo(SyncSource.TIGER_LINE);
        assertThat(metadata.id()).isEqualTo("tiger-line-north-dakota-2025");
        assertThat(metadata.title()).isEqualTo("2025 TIGER/Line - Census Tracts - North Dakota");
        assertThat(metadata.program()).isEqualTo(ResearchProgram.TIGER_LINE);
        assertThat(metadata.geography()).isEqualTo("North Dakota");
        assertThat(metadata.geographicLevel()).isEqualTo("Census tract");
        assertThat(metadata.vintageYear()).isEqualTo(2025);
        assertThat(metadata.releasedOn()).isEqualTo(LocalDate.of(2025, 9, 23));
        assertThat(metadata.sourceUrl())
                .isEqualTo("https://www2.census.gov/geo/tiger/TIGER2025/TRACT/tl_2025_38_tract.zip");
        assertThat(metadata.files())
                .extracting(PublicDatasetFile::format)
                .containsExactly(FileFormat.ZIP, FileFormat.PDF, FileFormat.OTHER);
    }
}
