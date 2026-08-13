package org.civicsrepo.sources;

import org.civicsrepo.generated.dto.FileFormat;
import org.civicsrepo.generated.dto.ResearchProgram;
import org.civicsrepo.generated.dto.SyncSource;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import org.springframework.stereotype.Component;

/** LODES workplace area characteristics metadata for the North Dakota sync slice. */
@Component
public class LodesMetadataAdapter implements PublicMetadataAdapter {
    private static final int VINTAGE_YEAR = 2023;
    private static final String GEOGRAPHY = "North Dakota";
    private static final String SOURCE_URL =
            "https://lehd.ces.census.gov/data/lodes/LODES8/nd/wac/nd_wac_S000_JT00_2023.csv.gz";
    private static final String DOCUMENTATION_URL =
            "https://lehd.ces.census.gov/data/lodes/LODES8/LODESTechDoc8.1.pdf";
    private static final LocalDate FALLBACK_RELEASED_ON = LocalDate.of(2023, 6, 1);

    private final SourceFileProbe sourceFileProbe;

    public LodesMetadataAdapter(SourceFileProbe sourceFileProbe) {
        this.sourceFileProbe = sourceFileProbe;
    }

    @Override
    public SyncSource source() {
        return SyncSource.LODES;
    }

    @Override
    public PublicDatasetMetadata firstVisualSlice() {
        Optional<SourceFileFacts> sourceFacts = sourceFileProbe.probe(SOURCE_URL);
        Optional<SourceFileFacts> documentationFacts = sourceFileProbe.probe(DOCUMENTATION_URL);

        return new PublicDatasetMetadata(
                "lodes-wac-north-dakota-2023",
                "2023 LODES Workplace Area Characteristics - North Dakota",
                ResearchProgram.LODES,
                "U.S. Census Bureau",
                "LEHD Origin-Destination Employment Statistics workplace area characteristics metadata for North Dakota workforce geography.",
                GEOGRAPHY,
                "Census block",
                VINTAGE_YEAR,
                releasedOn(sourceFacts),
                SOURCE_URL,
                DOCUMENTATION_URL,
                "U.S. Census Bureau. LEHD Origin-Destination Employment Statistics, Workplace Area Characteristics, North Dakota, 2023.",
                List.of(
                        new PublicDatasetFile(
                                "source-csv",
                                "LODES workplace area characteristics CSV",
                                FileFormat.CSV,
                                SOURCE_URL,
                                sizeBytes(sourceFacts)),
                        new PublicDatasetFile(
                                "technical-documentation",
                                "LODES technical documentation",
                                FileFormat.PDF,
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
