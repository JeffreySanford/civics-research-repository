package org.civicsrepo.repository;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.LinkedHashMap;
import java.util.Map;
import org.civicsrepo.dspace.DspaceManagedFields;
import org.civicsrepo.generated.dto.ResearchArtifactVersion;
import org.junit.jupiter.api.Test;

class RepositoryArtifactVersionMapperTest {
    @Test
    void mapsObservedVersionAndFixityFactsFromManagedDspaceMetadata() {
        Map<String, String> metadata = new LinkedHashMap<>();
        metadata.put("dc.title", "Observed research artifact");
        metadata.put("dc.date.issued", "2025-09-23");
        metadata.put("crr.source.url", "https://example.gov/releases/2025");
        metadata.put(DspaceManagedFields.DOI_FIELD, "10.1234/example.2025");
        metadata.put(DspaceManagedFields.VERSION_LABEL_FIELD, "2025.2");
        metadata.put(DspaceManagedFields.VERSION_DATE_FIELD, "2025-09-22");
        metadata.put(
                DspaceManagedFields.SOURCE_SHA256_FIELD,
                "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef");
        metadata.put(DspaceManagedFields.CAPTURED_AT_FIELD, "2026-09-12T18:45:00-05:00");
        metadata.put(DspaceManagedFields.IS_VERSION_OF_FIELD, "example-artifact");
        metadata.put(DspaceManagedFields.SUPERSEDES_FIELD, "example-artifact-2025-1");
        metadata.put(DspaceManagedFields.CHANGE_NOTE_FIELD, "Publisher-issued revision.");

        ResearchArtifactVersion version = RepositoryArtifactVersionMapper.toVersion(
                RepositoryFixtures.item("uuid", "Observed research artifact", metadata),
                "example-artifact-2025-2");

        assertThat(version.getId()).isEqualTo("example-artifact-2025-2");
        assertThat(version.getLabel()).isEqualTo("Observed research artifact");
        assertThat(version.getCurrent()).isTrue();
        assertThat(version.getVersionLabel()).isEqualTo("2025.2");
        assertThat(version.getVersionDate()).isEqualTo(LocalDate.of(2025, 9, 22));
        assertThat(version.getReleasedOn()).isEqualTo(LocalDate.of(2025, 9, 23));
        assertThat(version.getDoi()).isEqualTo("10.1234/example.2025");
        assertThat(version.getSourceUrl()).hasToString("https://example.gov/releases/2025");
        assertThat(version.getSourceSha256())
                .isEqualTo("0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef");
        assertThat(version.getCapturedAt())
                .isEqualTo(OffsetDateTime.parse("2026-09-12T18:45:00-05:00"));
        assertThat(version.getIsVersionOf()).isEqualTo("example-artifact");
        assertThat(version.getSupersedes()).isEqualTo("example-artifact-2025-1");
        assertThat(version.getChangeNote()).isEqualTo("Publisher-issued revision.");
    }

    @Test
    void leavesUnknownProvenanceAbsentInsteadOfInferringItFromVintageOrTitle() {
        Map<String, String> metadata = new LinkedHashMap<>();
        metadata.put("dc.title", "2025 research artifact");
        metadata.put("crr.vintage", "2025");
        metadata.put("crr.source.url", "https://example.gov/current");

        ResearchArtifactVersion version = RepositoryArtifactVersionMapper.toVersion(
                RepositoryFixtures.item("uuid", "2025 research artifact", metadata),
                "artifact-2025");

        assertThat(version.getVersionLabel()).isNull();
        assertThat(version.getVersionDate()).isNull();
        assertThat(version.getSourceSha256()).isNull();
        assertThat(version.getCapturedAt()).isNull();
        assertThat(version.getIsVersionOf()).isNull();
        assertThat(version.getSupersedes()).isNull();
        assertThat(version.getChangeNote()).isNull();
    }

    @Test
    void ignoresMalformedOptionalDatesAndCaptureTimesRatherThanInventingFallbacks() {
        Map<String, String> metadata = new LinkedHashMap<>();
        metadata.put("dc.title", "Artifact");
        metadata.put(DspaceManagedFields.VERSION_DATE_FIELD, "sometime-in-2025");
        metadata.put(DspaceManagedFields.CAPTURED_AT_FIELD, "yesterday");

        ResearchArtifactVersion version = RepositoryArtifactVersionMapper.toVersion(
                RepositoryFixtures.item("uuid", "Artifact", metadata), "artifact");

        assertThat(version.getVersionDate()).isNull();
        assertThat(version.getCapturedAt()).isNull();
    }
}
