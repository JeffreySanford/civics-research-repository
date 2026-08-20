package org.civicsrepo.dspace;

import static org.assertj.core.api.Assertions.assertThat;

import org.civicsrepo.sources.TigerLineMetadataAdapter;
import org.civicsrepo.sources.OfflineSourceFileProbe;
import java.time.LocalDate;
import java.util.List;
import org.civicsrepo.generated.dto.AccessLevel;
import org.civicsrepo.generated.dto.ResearchObjectType;
import org.civicsrepo.generated.dto.ResearchProgram;
import org.civicsrepo.sources.ResearchObjectMetadata;
import org.junit.jupiter.api.Test;

class DspaceItemPayloadMapperTest {
    private final DspaceItemPayloadMapper mapper = new DspaceItemPayloadMapper();

    @Test
    void mapsResearchObjectMetadataToDspaceItemPayload() {
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

    /**
     * A dataset adapter says nothing about DOIs or access, and must not write those fields empty.
     *
     * <p>An empty value is not "no opinion" to the reconciliation: it is a value, and writing one
     * would clear whatever the seed recorded on the item.
     */
    @Test
    void datasetPayloadOmitsFieldsTheAdapterHasNoOpinionAbout() {
        var payload = mapper.toItemPayload(ResearchObjectMetadata.dataset(
                "tiger-line-north-dakota-2025",
                "2025 TIGER/Line - Census Tracts - North Dakota",
                ResearchProgram.TIGER_LINE,
                "U.S. Census Bureau",
                "Census tract boundaries.",
                "North Dakota",
                "State",
                2025,
                LocalDate.of(2025, 9, 22),
                "https://www2.census.gov/geo/tiger/TIGER2025/TRACT/tl_2025_38_tract.zip",
                "https://www.census.gov/geographies/mapping-files/time-series/geo/tiger-line-file.html",
                "U.S. Census Bureau. 2025 TIGER/Line.",
                List.of()));

        assertThat(payload.metadata()).containsKey(DspaceManagedFields.RESOURCE_TYPE_FIELD);
        assertThat(payload.metadata()).containsKey(DspaceManagedFields.ACCESS_FIELD);
        assertThat(payload.metadata()).doesNotContainKey(DspaceManagedFields.DOI_FIELD);
        assertThat(payload.metadata()).doesNotContainKey(DspaceManagedFields.LICENSE_FIELD);
        assertThat(payload.metadata()).doesNotContainKey(DspaceManagedFields.RESEARCHER_FIELD);
        assertThat(payload.metadata()).doesNotContainKey(DspaceManagedFields.RELATION_FIELD);
    }

    /**
     * The encoding has to match tools/scripts/generate-saf.mjs exactly.
     *
     * <p>If a harvested object and a seeded one describe the same author differently, sync:diff
     * reports a change on every run and never settles. That is the failure the file manifest had
     * before its encoding was shared, and these two fields are the same shape of risk.
     */
    @Test
    void researcherAndRelationEncodingMatchesTheSeed() {
        var payload = mapper.toItemPayload(new ResearchObjectMetadata(
                "ces-wp-25-23-spatial-mismatch",
                "Re-assessing the Spatial Mismatch Hypothesis",
                ResearchProgram.LEHD,
                "U.S. Census Bureau",
                "Spatial mismatch and workplace pay premiums.",
                "United States",
                "National",
                2025,
                LocalDate.of(2025, 4, 1),
                "https://www2.census.gov/library/working-papers/2025/adrm/ces/CES-WP-25-23.pdf",
                "https://www.census.gov/library/working-papers/2025/adrm/CES-WP-25-23.html",
                "Card, Rothstein, Yi. CES-25-23, 2025.",
                List.of(),
                ResearchObjectType.PUBLICATION,
                AccessLevel.PUBLIC,
                null,
                "Public domain. A work of the U.S. Government, 17 U.S.C. 105.",
                "10.3386/w32252",
                List.of(
                        new ResearchObjectMetadata.ResearchAuthorMetadata("David Card", null),
                        new ResearchObjectMetadata.ResearchAuthorMetadata("Moises Yi", "0000-0002-1825-0097")),
                List.of(new ResearchObjectMetadata.ResearchObjectRelation(
                        "uses", "lehd-microdata-restricted", "Underlying job-level records."))));

        assertThat(payload.metadata().get(DspaceManagedFields.RESEARCHER_FIELD))
                .extracting(DspaceMetadataValue::value)
                .containsExactly(
                        "{\"name\":\"David Card\"}",
                        "{\"name\":\"Moises Yi\",\"orcid\":\"0000-0002-1825-0097\"}");

        assertThat(payload.metadata().get(DspaceManagedFields.RELATION_FIELD))
                .extracting(DspaceMetadataValue::value)
                .containsExactly(
                        "{\"verb\":\"uses\",\"target\":\"lehd-microdata-restricted\",\"note\":\"Underlying job-level records.\"}");

        assertThat(payload.metadata().get(DspaceManagedFields.DOI_FIELD))
                .extracting(DspaceMetadataValue::value)
                .containsExactly("10.3386/w32252");

        // Authors reach dc as well, which is the field every harvester already reads.
        assertThat(payload.metadata().get("dc.contributor.author"))
                .extracting(DspaceMetadataValue::value)
                .containsExactly("David Card", "Moises Yi");
    }
}
