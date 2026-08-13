package org.civicsrepo.sources;

import org.civicsrepo.generated.dto.FileFormat;
import org.civicsrepo.generated.dto.ResearchProgram;
import org.civicsrepo.generated.dto.SyncSource;
import static org.assertj.core.api.Assertions.assertThat;

import java.time.LocalDate;
import org.junit.jupiter.api.Test;

class SippMetadataAdapterTest {
    @Test
    void normalizesSippPublicUseMetadata() {
        SippMetadataAdapter adapter = new SippMetadataAdapter(new OfflineSourceFileProbe());

        PublicDatasetMetadata metadata = adapter.firstVisualSlice();

        assertThat(adapter.source()).isEqualTo(SyncSource.SIPP);
        assertThat(metadata.id()).isEqualTo("sipp-public-use-2025");
        assertThat(metadata.program()).isEqualTo(ResearchProgram.SIPP);
        assertThat(metadata.geography()).isEqualTo("United States");
        assertThat(metadata.vintageYear()).isEqualTo(2025);
        assertThat(metadata.files())
                .extracting(PublicDatasetFile::format)
                .containsExactly(FileFormat.CSV, FileFormat.OTHER);
    }

    @Test
    void fallsBackToCompiledMetadataWhenThePublisherCannotBeReached() {
        SippMetadataAdapter adapter = new SippMetadataAdapter(new OfflineSourceFileProbe());

        PublicDatasetMetadata metadata = adapter.firstVisualSlice();

        assertThat(metadata.releasedOn()).isEqualTo(LocalDate.of(2025, 9, 1));
        assertThat(metadata.files()).extracting(PublicDatasetFile::sizeBytes).containsOnlyNulls();
    }
}
