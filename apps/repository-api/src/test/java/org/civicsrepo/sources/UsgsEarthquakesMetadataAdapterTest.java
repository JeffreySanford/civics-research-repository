package org.civicsrepo.sources;

import org.civicsrepo.generated.dto.FileFormat;
import org.civicsrepo.generated.dto.ResearchProgram;
import org.civicsrepo.generated.dto.SyncSource;
import static org.assertj.core.api.Assertions.assertThat;

import java.time.LocalDate;
import org.junit.jupiter.api.Test;

class UsgsEarthquakesMetadataAdapterTest {
    @Test
    void normalizesEarthquakeOverlayMetadata() {
        UsgsEarthquakesMetadataAdapter adapter =
                new UsgsEarthquakesMetadataAdapter(new OfflineSourceFileProbe());

        ResearchObjectMetadata metadata = adapter.firstVisualSlice();

        assertThat(adapter.source()).isEqualTo(SyncSource.USGS_EARTHQUAKES);
        assertThat(metadata.id()).isEqualTo("usgs-earthquakes-overlay");
        assertThat(metadata.program()).isEqualTo(ResearchProgram.USGS);
        assertThat(metadata.geography()).isEqualTo("United States");
        assertThat(metadata.sourceUrl())
                .isEqualTo("https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson");
        assertThat(metadata.files())
                .extracting(ResearchObjectFile::format)
                .containsExactly(FileFormat.GEOJSON, FileFormat.OTHER);
    }

    @Test
    void fallsBackToCompiledMetadataWhenThePublisherCannotBeReached() {
        UsgsEarthquakesMetadataAdapter adapter =
                new UsgsEarthquakesMetadataAdapter(new OfflineSourceFileProbe());

        ResearchObjectMetadata metadata = adapter.firstVisualSlice();

        assertThat(metadata.releasedOn()).isEqualTo(LocalDate.of(2026, 1, 1));
        assertThat(metadata.files()).extracting(ResearchObjectFile::sizeBytes).containsOnlyNulls();
    }
}
