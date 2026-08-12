package org.civicsrepo.dspace;

import static org.assertj.core.api.Assertions.assertThat;

import org.civicsrepo.sources.TigerLineMetadataAdapter;
import org.civicsrepo.sources.OfflineSourceFileProbe;
import org.junit.jupiter.api.Test;

class DspaceItemPayloadMapperTest {
    @Test
    void mapsPublicDatasetMetadataToDspaceItemPayload() {
        DspaceItemPayloadMapper mapper = new DspaceItemPayloadMapper();

        DspaceItemPayload payload = mapper.toItemPayload(new TigerLineMetadataAdapter(new OfflineSourceFileProbe()).firstVisualSlice());

        assertThat(payload.name()).isEqualTo("2025 TIGER/Line - Census Tracts - North Dakota");
        assertThat(payload.type()).isEqualTo("item");
        assertThat(payload.metadata()).containsKeys(
                "dc.title",
                "dc.contributor.author",
                "dc.description.abstract",
                "dc.date.issued",
                "dc.identifier.uri",
                "dc.identifier.citation",
                "crr.identifier.source",
                "crr.geography.level",
                "crr.vintage");
        assertThat(firstValue(payload, "dc.title")).isEqualTo("2025 TIGER/Line - Census Tracts - North Dakota");
        assertThat(firstValue(payload, "dc.date.issued")).isEqualTo("2025-09-23");
        assertThat(firstValue(payload, "crr.identifier.source")).isEqualTo("tiger-line-north-dakota-2025");
        assertThat(payload.bitstreams()).hasSize(3);
        assertThat(payload.bitstreams())
                .extracting(DspaceBitstreamPayload::bundleName)
                .containsOnly("ORIGINAL");
    }

    private String firstValue(DspaceItemPayload payload, String field) {
        return payload.metadata().get(field).getFirst().value();
    }
}
