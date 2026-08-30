package org.civicsrepo.federation;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.net.URI;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import org.civicsrepo.generated.dto.ResearchObjectOrigin;
import org.civicsrepo.generated.dto.ResearchObjectType;
import org.civicsrepo.generated.dto.ResearchProgram;
import org.civicsrepo.generated.dto.SourceSystem;
import org.civicsrepo.search.DiscoveryDocument;
import org.junit.jupiter.api.Test;

class FederatedDiscoveryDocumentMapperTest {
    private final FederatedDiscoveryDocumentMapper mapper = new FederatedDiscoveryDocumentMapper();

    @Test
    void preservesDataDrivenProgramAndFederatedProvenanceWithoutExpandingLegacyEnum() {
        FederatedResearchRecord record = new FederatedResearchRecord(
                FederatedSourceSystem.DOE_OSTI,
                "12345",
                "Advanced reactor materials research",
                "A normalized external research record.",
                "U.S. Department of Energy",
                "Office of Science",
                ResearchObjectType.PUBLICATION,
                URI.create("https://www.osti.gov/biblio/12345"),
                OffsetDateTime.parse("2026-08-20T10:00:00Z"),
                OffsetDateTime.parse("2026-08-29T12:00:00Z"),
                "osti-v1",
                List.of("Ada Researcher"),
                List.of("reactors", "materials"),
                Map.of("doi", "10.1234/example", "citation", "Example citation"));

        DiscoveryDocument document = mapper.toDiscoveryDocument(record);

        assertEquals("DOE_OSTI:12345", document.result().getId());
        assertEquals(ResearchObjectOrigin.FEDERATED, document.result().getOrigin());
        assertEquals(SourceSystem.DOE_OSTI, document.result().getSourceSystem());
        assertEquals(ResearchProgram.OTHER, document.result().getProgram());
        assertEquals("Office of Science", document.result().getProgramName());
        assertEquals("Office of Science", document.programName());
        assertEquals("U.S. Department of Energy", document.result().getPublisher());
        assertEquals(List.of("Ada Researcher"), document.authors());
        assertEquals(List.of("reactors", "materials"), document.subjects());
        assertEquals("10.1234/example", document.doi());
        assertEquals("Example citation", document.citation());
    }

    @Test
    void discoveryDocumentFallsBackToLegacyProgramWhenCanonicalNameIsBlank() {
        FederatedResearchRecord record = new FederatedResearchRecord(
                FederatedSourceSystem.DATA_GOV,
                "abc",
                "Dataset",
                "Summary",
                "Publisher",
                "",
                ResearchObjectType.DATASET,
                URI.create("https://catalog.data.gov/dataset/abc"),
                null,
                OffsetDateTime.parse("2026-08-29T12:00:00Z"),
                "data-gov-v1",
                List.of(),
                List.of(),
                Map.of());

        DiscoveryDocument document = mapper.toDiscoveryDocument(record);

        assertEquals(ResearchProgram.OTHER.getValue(), document.programName());
    }
}
