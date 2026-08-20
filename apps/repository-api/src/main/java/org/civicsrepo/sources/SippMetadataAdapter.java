package org.civicsrepo.sources;

import org.civicsrepo.generated.dto.FileFormat;
import org.civicsrepo.generated.dto.ResearchProgram;
import org.civicsrepo.generated.dto.SyncSource;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import org.springframework.stereotype.Component;

/** Survey of Income and Program Participation public-use metadata for the sync slice. */
@Component
public class SippMetadataAdapter implements PublicMetadataAdapter {
    private static final int VINTAGE_YEAR = 2025;
    private static final String SOURCE_URL =
            "https://www2.census.gov/programs-surveys/sipp/data/datasets/2025/pu2025_csv.zip";
    private static final String DOCUMENTATION_URL =
            "https://www.census.gov/programs-surveys/sipp/tech-documentation.html";
    private static final LocalDate FALLBACK_RELEASED_ON = LocalDate.of(2025, 9, 1);

    private final SourceFileProbe sourceFileProbe;

    public SippMetadataAdapter(SourceFileProbe sourceFileProbe) {
        this.sourceFileProbe = sourceFileProbe;
    }

    @Override
    public SyncSource source() {
        return SyncSource.SIPP;
    }

    @Override
    public ResearchObjectMetadata firstVisualSlice() {
        Optional<SourceFileFacts> sourceFacts = sourceFileProbe.probe(SOURCE_URL);
        Optional<SourceFileFacts> documentationFacts = sourceFileProbe.probe(DOCUMENTATION_URL);

        return ResearchObjectMetadata.dataset(
                "sipp-public-use-2025",
                "2025 SIPP Public Use Data",
                ResearchProgram.SIPP,
                "U.S. Census Bureau",
                "Survey of Income and Program Participation public-use metadata for longitudinal income, program participation, and household research.",
                "United States",
                "National",
                VINTAGE_YEAR,
                releasedOn(sourceFacts),
                SOURCE_URL,
                DOCUMENTATION_URL,
                "U.S. Census Bureau. Survey of Income and Program Participation Public Use Data, 2025.",
                List.of(
                        new ResearchObjectFile(
                                "source-archive",
                                "SIPP public use archive",
                                FileFormat.CSV,
                                SOURCE_URL,
                                sizeBytes(sourceFacts)),
                        new ResearchObjectFile(
                                "technical-documentation",
                                "SIPP technical documentation",
                                FileFormat.OTHER,
                                DOCUMENTATION_URL,
                                sizeBytes(documentationFacts))));
    }

    private LocalDate releasedOn(Optional<SourceFileFacts> facts) {
        return facts.map(SourceFileFacts::lastModified).orElse(null) == null
                ? FALLBACK_RELEASED_ON
                : facts.orElseThrow().lastModified();
    }

    private Long sizeBytes(Optional<SourceFileFacts> facts) {
        return facts.map(SourceFileFacts::sizeBytes).orElse(null);
    }
}
