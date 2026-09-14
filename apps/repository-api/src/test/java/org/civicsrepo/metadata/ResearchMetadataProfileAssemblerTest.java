package org.civicsrepo.metadata;

import static org.assertj.core.api.Assertions.assertThat;

import java.net.URI;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import org.civicsrepo.generated.dto.AccessLevel;
import org.civicsrepo.generated.dto.DatasetFile;
import org.civicsrepo.generated.dto.FileFormat;
import org.civicsrepo.generated.dto.RepositorySource;
import org.civicsrepo.generated.dto.ResearchAccessGuidance;
import org.civicsrepo.generated.dto.ResearchArtifactVersion;
import org.civicsrepo.generated.dto.ResearchArtifactVersionHistory;
import org.civicsrepo.generated.dto.ResearchAuthor;
import org.civicsrepo.generated.dto.ResearchObjectDetail;
import org.civicsrepo.generated.dto.ResearchObjectOrigin;
import org.civicsrepo.generated.dto.ResearchObjectType;
import org.civicsrepo.generated.dto.ResearchProgram;
import org.civicsrepo.generated.dto.ResearchRelation;
import org.civicsrepo.generated.dto.ResearchRelationVerb;
import org.civicsrepo.generated.dto.SourceSystem;
import org.civicsrepo.generated.dto.VersionHistoryStatus;
import org.junit.jupiter.api.Test;

class ResearchMetadataProfileAssemblerTest {
    private static final URI SOURCE_URL = URI.create("https://example.gov/source");
    private static final URI DOCUMENTATION_URL = URI.create("https://example.gov/documentation");

    private final ResearchMetadataProfileAssembler assembler = new ResearchMetadataProfileAssembler();

    @Test
    void assemblesPublicDatasetWithoutChangingFacts() {
        ResearchObjectDetail detail = detail("public-dataset", ResearchObjectType.DATASET)
                .documentationUrl(DOCUMENTATION_URL)
                .geography("North Dakota")
                .geographicLevel("State")
                .vintageYear(2025)
                .releasedOn(LocalDate.of(2025, 9, 23))
                .accessLevel(AccessLevel.PUBLIC)
                .license("Public domain")
                .files(List.of(new DatasetFile(
                        "source-zip", "Source archive", FileFormat.ZIP, URI.create("https://example.gov/source.zip"))));

        ResearchMetadataProfile profile = assembler.assemble(detail, observedHistory(detail));

        assertThat(profile.id()).isEqualTo("public-dataset");
        assertThat(profile.type()).isEqualTo(ResearchObjectType.DATASET);
        assertThat(profile.sourceUrl()).isEqualTo(SOURCE_URL);
        assertThat(profile.documentationUrl()).isEqualTo(DOCUMENTATION_URL);
        assertThat(profile.geography()).isEqualTo("North Dakota");
        assertThat(profile.geographicLevel()).isEqualTo("State");
        assertThat(profile.distributions()).singleElement().satisfies(distribution -> {
            assertThat(distribution.id()).isEqualTo("source-zip");
            assertThat(distribution.format()).isEqualTo(FileFormat.ZIP);
        });
    }

    @Test
    void preservesDoiBearingPublicationAuthorAndOrcid() {
        ResearchAuthor author = new ResearchAuthor("Jane Researcher");
        author.setOrcid("0000-0002-1825-0097");
        ResearchObjectDetail detail = detail("publication", ResearchObjectType.PUBLICATION)
                .doi("10.1234/example")
                .authors(List.of(author));

        ResearchMetadataProfile profile = assembler.assemble(detail, observedHistory(detail));

        assertThat(profile.type()).isEqualTo(ResearchObjectType.PUBLICATION);
        assertThat(profile.doi()).isEqualTo("10.1234/example");
        assertThat(profile.authors()).containsExactly(
                new ResearchMetadataProfile.Author("Jane Researcher", "0000-0002-1825-0097"));
    }

    @Test
    void preservesMethodologyProjectAndCodeObjectTypes() {
        ResearchMetadataProfile methodology = assembler.assemble(
                detail("methodology", ResearchObjectType.METHODOLOGY),
                observedHistory(detail("methodology", ResearchObjectType.METHODOLOGY)));
        ResearchMetadataProfile project = assembler.assemble(
                detail("project", ResearchObjectType.PROJECT),
                observedHistory(detail("project", ResearchObjectType.PROJECT)));
        ResearchMetadataProfile code = assembler.assemble(
                detail("code", ResearchObjectType.CODE),
                observedHistory(detail("code", ResearchObjectType.CODE)));

        assertThat(methodology.type()).isEqualTo(ResearchObjectType.METHODOLOGY);
        assertThat(project.type()).isEqualTo(ResearchObjectType.PROJECT);
        assertThat(code.type()).isEqualTo(ResearchObjectType.CODE);
    }

    @Test
    void preservesRestrictedGuidanceWithoutInventingDistribution() {
        ResearchAccessGuidance guidance = new ResearchAccessGuidance();
        guidance.setMechanism("FSRDC");
        guidance.setAccessUrl(URI.create("https://www.census.gov/about/adrm/fsrdc.html"));
        guidance.setInstructions(
                "Access requires an approved research proposal and Special Sworn Status through a Federal Statistical Research Data Center.");
        guidance.setRestrictionBasis("Title 13, U.S. Code");

        ResearchObjectDetail detail = detail("lehd-microdata-restricted", ResearchObjectType.DATASET)
                .accessLevel(AccessLevel.RESTRICTED)
                .accessNote("No confidential records are held by this repository.")
                .accessGuidance(guidance)
                .files(List.of());

        ResearchMetadataProfile restricted = assembler.assemble(detail, observedHistory(detail));

        assertThat(restricted.access().level()).isEqualTo(AccessLevel.RESTRICTED);
        assertThat(restricted.access().guidance().mechanism()).isEqualTo("FSRDC");
        assertThat(restricted.access().guidance().restrictionBasis()).isEqualTo("Title 13, U.S. Code");
        assertThat(restricted.distributions()).isEmpty();
    }

    @Test
    void copiesObservedDspaceVersionLineageExactly() {
        ResearchObjectDetail detail = detail("tiger-line-north-dakota-2025", ResearchObjectType.DATASET)
                .vintageYear(2025);
        ResearchArtifactVersion current = new ResearchArtifactVersion(
                        "dspace-version:2", "2025 TIGER/Line - Census Tracts - North Dakota")
                .current(true)
                .versionLabel("Repository version 2")
                .versionDate(LocalDate.of(2025, 9, 23))
                .releasedOn(LocalDate.of(2025, 9, 23))
                .doi("10.1234/tiger-current")
                .sourceUrl(SOURCE_URL)
                .sourceSha256("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")
                .capturedAt(OffsetDateTime.parse("2026-09-13T18:00:00-05:00"))
                .isVersionOf("tiger-line-north-dakota-2025")
                .supersedes("dspace-version:1")
                .changeNote("Updated source snapshot.");
        ResearchArtifactVersion previous = new ResearchArtifactVersion(
                        "dspace-version:1", "2025 TIGER/Line - Census Tracts - North Dakota")
                .current(false)
                .versionLabel("Repository version 1")
                .sourceUrl(SOURCE_URL)
                .isVersionOf("tiger-line-north-dakota-2025");
        ResearchArtifactVersionHistory history = new ResearchArtifactVersionHistory(
                        detail.getId(), VersionHistoryStatus.HISTORY_AVAILABLE, List.of(current, previous))
                .note("DSpace-native version history.");

        ResearchMetadataProfile versioned = assembler.assemble(detail, history);

        assertThat(versioned.versions().status()).isEqualTo(VersionHistoryStatus.HISTORY_AVAILABLE);
        assertThat(versioned.versions().items()).hasSize(2);
        assertThat(versioned.versions().items().get(0).supersedes()).isEqualTo("dspace-version:1");
        assertThat(versioned.versions().items().get(0).sourceSha256())
                .isEqualTo("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
        assertThat(versioned.versions().items().get(0).capturedAt())
                .isEqualTo(OffsetDateTime.parse("2026-09-13T18:00:00-05:00"));
    }

    @Test
    void preservesPartialMetadataAsUnknown() {
        ResearchObjectDetail detail = detail("partial", ResearchObjectType.DATASET)
                .documentationUrl(null)
                .geography(null)
                .geographicLevel(null)
                .vintageYear(null)
                .releasedOn(null)
                .doi(null)
                .authors(List.of())
                .relations(List.of())
                .accessGuidance(null);
        ResearchArtifactVersionHistory history =
                new ResearchArtifactVersionHistory(detail.getId(), VersionHistoryStatus.UNAVAILABLE, List.of());

        ResearchMetadataProfile partial = assembler.assemble(detail, history);

        assertThat(partial.doi()).isNull();
        assertThat(partial.documentationUrl()).isNull();
        assertThat(partial.geography()).isNull();
        assertThat(partial.geographicLevel()).isNull();
        assertThat(partial.vintageYear()).isNull();
        assertThat(partial.releasedOn()).isNull();
        assertThat(partial.authors()).isEmpty();
        assertThat(partial.relations()).isEmpty();
        assertThat(partial.versions().status()).isEqualTo(VersionHistoryStatus.UNAVAILABLE);
        assertThat(partial.versions().items()).isEmpty();
    }

    @Test
    void assemblyIsDeterministicAndVintageDoesNotInferPredecessor() {
        ResearchObjectDetail detail = detail("deterministic", ResearchObjectType.DATASET)
                .vintageYear(2025);
        ResearchArtifactVersion observed = new ResearchArtifactVersion(detail.getId(), detail.getTitle())
                .current(true)
                .sourceUrl(detail.getSourceUrl());
        ResearchArtifactVersionHistory history = new ResearchArtifactVersionHistory(
                detail.getId(), VersionHistoryStatus.OBSERVED_CURRENT_ONLY, List.of(observed));

        ResearchMetadataProfile first = assembler.assemble(detail, history);
        ResearchMetadataProfile second = assembler.assemble(detail, history);

        assertThat(first).isEqualTo(second);
        assertThat(first.versions().items()).singleElement().satisfies(version -> {
            assertThat(version.id()).isEqualTo("deterministic");
            assertThat(version.supersedes()).isNull();
            assertThat(version.versionLabel()).isNull();
        });
    }

    @Test
    void copiesTypedRelationsWithoutRetainingMutableDto() {
        ResearchRelation relation = new ResearchRelation(
                ResearchRelationVerb.IS_DERIVED_FROM,
                "lehd-microdata-restricted",
                "LEHD microdata",
                ResearchObjectType.DATASET);
        relation.setTargetAccessLevel(AccessLevel.RESTRICTED);
        relation.setNote("Underlying restricted records.");
        ResearchObjectDetail detail = detail("public-product", ResearchObjectType.DATASET)
                .relations(List.of(relation));

        ResearchMetadataProfile profile = assembler.assemble(detail, observedHistory(detail));
        relation.setNote("mutated after assembly");

        assertThat(profile.relations()).containsExactly(new ResearchMetadataProfile.Relation(
                "isDerivedFrom",
                "lehd-microdata-restricted",
                "LEHD microdata",
                ResearchObjectType.DATASET,
                AccessLevel.RESTRICTED,
                "Underlying restricted records."));
    }

    private ResearchObjectDetail detail(String id, ResearchObjectType type) {
        return new ResearchObjectDetail(
                        RepositorySource.FIXTURE,
                        id,
                        "Title for " + id,
                        ResearchProgram.OTHER,
                        "Example publisher",
                        "Summary for " + id,
                        List.of(),
                        "Citation for " + id,
                        SOURCE_URL,
                        List.of("subject-a", "subject-b"),
                        List.of(),
                        ResearchObjectOrigin.FIXTURE,
                        SourceSystem.OTHER)
                .contentType(type)
                .accessLevel(AccessLevel.PUBLIC)
                .files(List.of())
                .authors(List.of())
                .relations(List.of());
    }

    private ResearchArtifactVersionHistory observedHistory(ResearchObjectDetail detail) {
        ResearchArtifactVersion observed = new ResearchArtifactVersion(detail.getId(), detail.getTitle())
                .current(true)
                .releasedOn(detail.getReleasedOn())
                .doi(detail.getDoi())
                .sourceUrl(detail.getSourceUrl());
        return new ResearchArtifactVersionHistory(
                detail.getId(), VersionHistoryStatus.OBSERVED_CURRENT_ONLY, List.of(observed));
    }
}
