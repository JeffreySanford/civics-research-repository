package org.civicsrepo.sources;

import org.civicsrepo.generated.dto.SyncSource;
import org.civicsrepo.generated.dto.FileFormat;
import org.civicsrepo.generated.dto.ResearchProgram;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.tuple;

import java.time.LocalDate;
import java.util.Optional;
import org.junit.jupiter.api.Test;

class TigerLineMetadataAdapterTest {
    @Test
    void normalizesNorthDakotaTractMetadata() {
        TigerLineMetadataAdapter adapter = new TigerLineMetadataAdapter(new OfflineSourceFileProbe());

        ResearchObjectMetadata metadata = adapter.firstVisualSlice();

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
                .extracting(ResearchObjectFile::format)
                .containsExactly(FileFormat.ZIP, FileFormat.PDF, FileFormat.OTHER);
    }

    /**
     * Size and publication date describe the file as the publisher currently offers it, so they are
     * read from the host rather than compiled in: a compiled size is wrong the moment the Bureau
     * reissues the archive.
     */
    @Test
    void takesSizeAndPublicationDateFromThePublisher() {
        TigerLineMetadataAdapter adapter = new TigerLineMetadataAdapter(
                (url) -> Optional.of(new SourceFileFacts(url.endsWith(".zip") ? 91_234_567L : 4_096L,
                        LocalDate.of(2026, 3, 4))));

        ResearchObjectMetadata metadata = adapter.firstVisualSlice();

        assertThat(metadata.releasedOn()).isEqualTo(LocalDate.of(2026, 3, 4));
        assertThat(metadata.files())
                .extracting(ResearchObjectFile::id, ResearchObjectFile::sizeBytes)
                .containsExactly(
                        tuple("source-zip", 91_234_567L),
                        tuple("technical-documentation", 4_096L),
                        // A landing page, not a file; a byte count for it would mean nothing.
                        tuple("source-landing-page", null));
    }

    /** An unreachable publisher must degrade to compiled metadata, not fail the sync. */
    @Test
    void fallsBackToCompiledMetadataWhenThePublisherCannotBeReached() {
        TigerLineMetadataAdapter adapter = new TigerLineMetadataAdapter(new OfflineSourceFileProbe());

        ResearchObjectMetadata metadata = adapter.firstVisualSlice();

        assertThat(metadata.releasedOn()).isEqualTo(LocalDate.of(2025, 9, 23));
        assertThat(metadata.files()).extracting(ResearchObjectFile::sizeBytes).containsOnlyNulls();
    }

    /** A host that answers but sends no Last-Modified must not leave the release date empty. */
    @Test
    void keepsTheCompiledDateWhenThePublisherSendsNoLastModified() {
        TigerLineMetadataAdapter adapter =
                new TigerLineMetadataAdapter((url) -> Optional.of(new SourceFileFacts(512L, null)));

        ResearchObjectMetadata metadata = adapter.firstVisualSlice();

        assertThat(metadata.releasedOn()).isEqualTo(LocalDate.of(2025, 9, 23));
        assertThat(metadata.files().getFirst().sizeBytes()).isEqualTo(512L);
    }
}
