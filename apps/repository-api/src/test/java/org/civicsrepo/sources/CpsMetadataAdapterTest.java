package org.civicsrepo.sources;

import org.civicsrepo.generated.dto.FileFormat;
import org.civicsrepo.generated.dto.ResearchProgram;
import org.civicsrepo.generated.dto.SyncSource;
import static org.assertj.core.api.Assertions.assertThat;

import java.time.LocalDate;
import org.junit.jupiter.api.Test;

class CpsMetadataAdapterTest {
    @Test
    void normalizesCurrentPopulationSurveyMetadata() {
        CpsMetadataAdapter adapter = new CpsMetadataAdapter(new OfflineSourceFileProbe());

        ResearchObjectMetadata metadata = adapter.firstVisualSlice();

        assertThat(adapter.source()).isEqualTo(SyncSource.CPS);
        assertThat(metadata.id()).isEqualTo("cps-public-use-2025");
        assertThat(metadata.program()).isEqualTo(ResearchProgram.CPS);
        assertThat(metadata.geography()).isEqualTo("United States");
        assertThat(metadata.vintageYear()).isEqualTo(2025);
        assertThat(metadata.files())
                .extracting(ResearchObjectFile::format)
                .containsExactly(FileFormat.OTHER, FileFormat.OTHER);
    }

    @Test
    void fallsBackToCompiledMetadataWhenThePublisherCannotBeReached() {
        CpsMetadataAdapter adapter = new CpsMetadataAdapter(new OfflineSourceFileProbe());

        ResearchObjectMetadata metadata = adapter.firstVisualSlice();

        assertThat(metadata.releasedOn()).isEqualTo(LocalDate.of(2025, 9, 1));
        assertThat(metadata.files()).extracting(ResearchObjectFile::sizeBytes).containsOnlyNulls();
    }
}
