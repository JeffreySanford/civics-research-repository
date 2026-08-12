package org.civicsrepo.dspace;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import org.civicsrepo.datasets.FileFormat;
import org.civicsrepo.sources.TigerLineMetadataAdapter;
import org.junit.jupiter.api.Test;

class DspaceFileManifestTest {
    private static final DspaceBitstreamPayload ENTRY = new DspaceBitstreamPayload(
            "source-zip",
            "TIGER/Line source archive",
            "ORIGINAL",
            FileFormat.ZIP,
            "https://www2.census.gov/geo/tiger/TIGER2025/TRACT/tl_2025_38_tract.zip",
            123456L);

    @Test
    void roundTripsAManifestEntry() {
        DspaceBitstreamPayload decoded =
                DspaceFileManifest.decode(DspaceFileManifest.encode(ENTRY)).orElseThrow();

        assertThat(decoded).isEqualTo(ENTRY);
    }

    @Test
    void roundTripsAnEntryWithNoKnownSize() {
        DspaceBitstreamPayload withoutSize = new DspaceBitstreamPayload(
                ENTRY.id(), ENTRY.name(), ENTRY.bundleName(), ENTRY.format(), ENTRY.sourceUrl(), null);

        DspaceBitstreamPayload decoded =
                DspaceFileManifest.decode(DspaceFileManifest.encode(withoutSize)).orElseThrow();

        assertThat(decoded.sizeBytes()).isNull();
        assertThat(decoded).isEqualTo(withoutSize);
    }

    /** A URL can contain any delimiter worth choosing, which is why entries are JSON. */
    @Test
    void survivesUrlsContainingDelimiterCharacters() {
        DspaceBitstreamPayload awkward = new DspaceBitstreamPayload(
                "query-url",
                "Feed | with, delimiters",
                "ORIGINAL",
                FileFormat.GEOJSON,
                "https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&minmag=2.5",
                null);

        assertThat(DspaceFileManifest.decode(DspaceFileManifest.encode(awkward)).orElseThrow())
                .isEqualTo(awkward);
    }

    /** One malformed value must not break a dataset page. */
    @Test
    void ignoresUnparseableEntries() {
        assertThat(DspaceFileManifest.decode("not json")).isEmpty();
        assertThat(DspaceFileManifest.decode("[1,2,3]")).isEmpty();
        assertThat(DspaceFileManifest.decode("")).isEmpty();
        assertThat(DspaceFileManifest.decode(null)).isEmpty();
    }

    @Test
    void treatsAnUnknownFormatAsOther() {
        DspaceBitstreamPayload decoded = DspaceFileManifest.decode(
                        "{\"id\":\"x\",\"format\":\"PARQUET\",\"url\":\"https://example.gov/x\"}")
                .orElseThrow();

        assertThat(decoded.format()).isEqualTo(FileFormat.OTHER);
    }

    @Test
    void fallsBackToTheIdWhenNoLabelIsRecorded() {
        DspaceBitstreamPayload decoded =
                DspaceFileManifest.decode("{\"id\":\"source-zip\",\"url\":\"https://example.gov/x\"}").orElseThrow();

        assertThat(decoded.name()).isEqualTo("source-zip");
        assertThat(decoded.bundleName()).isEqualTo("ORIGINAL");
    }

    @Test
    void mapsEveryAdapterFileIntoTheManifestField() {
        DspaceItemPayload payload =
                new DspaceItemPayloadMapper().toItemPayload(new TigerLineMetadataAdapter().firstVisualSlice());

        List<DspaceMetadataValue> manifest = payload.metadata().get(DspaceFileManifest.FIELD);

        assertThat(manifest).hasSameSizeAs(payload.bitstreams());
        assertThat(manifest).allSatisfy((value) -> assertThat(DspaceFileManifest.decode(value.value())).isPresent());
        assertThat(manifest)
                .extracting((value) -> DspaceFileManifest.decode(value.value()).orElseThrow().id())
                .containsExactly("source-zip", "technical-documentation", "source-landing-page");
    }
}
