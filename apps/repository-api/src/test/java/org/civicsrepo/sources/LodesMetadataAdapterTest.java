package org.civicsrepo.sources;

import org.civicsrepo.generated.dto.FileFormat;
import org.civicsrepo.generated.dto.ResearchProgram;
import org.civicsrepo.generated.dto.SyncSource;
import static org.assertj.core.api.Assertions.assertThat;

import java.time.LocalDate;
import org.junit.jupiter.api.Test;

class LodesMetadataAdapterTest {
    @Test
    void normalizesNorthDakotaWacMetadata() {
        LodesMetadataAdapter adapter = new LodesMetadataAdapter(new OfflineSourceFileProbe());

        ResearchObjectMetadata metadata = adapter.firstVisualSlice();

        assertThat(adapter.source()).isEqualTo(SyncSource.LODES);
        assertThat(metadata.id()).isEqualTo("lodes-wac-north-dakota-2023");
        assertThat(metadata.program()).isEqualTo(ResearchProgram.LODES);
        assertThat(metadata.geography()).isEqualTo("North Dakota");
        assertThat(metadata.vintageYear()).isEqualTo(2023);
        assertThat(metadata.sourceUrl())
                .isEqualTo(
                        "https://lehd.ces.census.gov/data/lodes/LODES8/nd/wac/nd_wac_S000_JT00_2023.csv.gz");
        assertThat(metadata.files())
                .extracting(ResearchObjectFile::format)
                .containsExactly(FileFormat.CSV, FileFormat.PDF);
    }

    @Test
    void fallsBackToCompiledMetadataWhenThePublisherCannotBeReached() {
        LodesMetadataAdapter adapter = new LodesMetadataAdapter(new OfflineSourceFileProbe());

        ResearchObjectMetadata metadata = adapter.firstVisualSlice();

        assertThat(metadata.releasedOn()).isEqualTo(LocalDate.of(2023, 6, 1));
        assertThat(metadata.files()).extracting(ResearchObjectFile::sizeBytes).containsOnlyNulls();
    }
}
