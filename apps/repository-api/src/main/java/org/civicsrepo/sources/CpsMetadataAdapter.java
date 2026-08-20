package org.civicsrepo.sources;

import org.civicsrepo.generated.dto.FileFormat;
import org.civicsrepo.generated.dto.ResearchProgram;
import org.civicsrepo.generated.dto.SyncSource;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import org.springframework.stereotype.Component;

/** Current Population Survey public-use metadata for the repository sync slice. */
@Component
public class CpsMetadataAdapter implements PublicMetadataAdapter {
    private static final int VINTAGE_YEAR = 2025;
    private static final String SOURCE_URL =
            "https://www2.census.gov/programs-surveys/cps/datasets/2025/basic/jan25pub.zip";
    private static final String DOCUMENTATION_URL =
            "https://www.census.gov/programs-surveys/cps/technical-documentation/complete.html";
    private static final LocalDate FALLBACK_RELEASED_ON = LocalDate.of(2025, 9, 1);

    private final SourceFileProbe sourceFileProbe;

    public CpsMetadataAdapter(SourceFileProbe sourceFileProbe) {
        this.sourceFileProbe = sourceFileProbe;
    }

    @Override
    public SyncSource source() {
        return SyncSource.CPS;
    }

    @Override
    public ResearchObjectMetadata firstVisualSlice() {
        Optional<SourceFileFacts> sourceFacts = sourceFileProbe.probe(SOURCE_URL);
        Optional<SourceFileFacts> documentationFacts = sourceFileProbe.probe(DOCUMENTATION_URL);

        return ResearchObjectMetadata.dataset(
                "cps-public-use-2025",
                "2025 Current Population Survey Public Use Data",
                ResearchProgram.CPS,
                "U.S. Census Bureau",
                "Current Population Survey public-use metadata for labor force, employment, and demographic research.",
                "United States",
                "National",
                VINTAGE_YEAR,
                releasedOn(sourceFacts),
                SOURCE_URL,
                DOCUMENTATION_URL,
                "U.S. Census Bureau. Current Population Survey Public Use Data, 2025.",
                List.of(
                        new ResearchObjectFile(
                                "source-directory",
                                "CPS basic monthly data directory",
                                FileFormat.OTHER,
                                SOURCE_URL,
                                sizeBytes(sourceFacts)),
                        new ResearchObjectFile(
                                "technical-documentation",
                                "CPS technical documentation",
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
