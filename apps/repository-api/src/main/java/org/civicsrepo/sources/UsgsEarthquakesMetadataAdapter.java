package org.civicsrepo.sources;

import org.civicsrepo.generated.dto.FileFormat;
import org.civicsrepo.generated.dto.ResearchProgram;
import org.civicsrepo.generated.dto.SyncSource;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import org.springframework.stereotype.Component;

/** USGS earthquake overlay metadata for contextual map display. */
@Component
public class UsgsEarthquakesMetadataAdapter implements PublicMetadataAdapter {
    private static final int VINTAGE_YEAR = 2026;
    private static final String SOURCE_URL =
            "https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson";
    private static final String DOCUMENTATION_URL = "https://earthquake.usgs.gov/fdsnws/event/1/";
    private static final LocalDate FALLBACK_RELEASED_ON = LocalDate.of(2026, 1, 1);

    private final SourceFileProbe sourceFileProbe;

    public UsgsEarthquakesMetadataAdapter(SourceFileProbe sourceFileProbe) {
        this.sourceFileProbe = sourceFileProbe;
    }

    @Override
    public SyncSource source() {
        return SyncSource.USGS_EARTHQUAKES;
    }

    @Override
    public PublicDatasetMetadata firstVisualSlice() {
        Optional<SourceFileFacts> sourceFacts = sourceFileProbe.probe(SOURCE_URL);
        Optional<SourceFileFacts> documentationFacts = sourceFileProbe.probe(DOCUMENTATION_URL);

        return new PublicDatasetMetadata(
                "usgs-earthquakes-overlay",
                "USGS Earthquake Overlay",
                ResearchProgram.USGS,
                "U.S. Geological Survey",
                "Earthquake Hazards Program GeoJSON overlay metadata used for contextual map display and accessible event lists.",
                "United States",
                "Point event",
                VINTAGE_YEAR,
                releasedOn(sourceFacts),
                SOURCE_URL,
                DOCUMENTATION_URL,
                "U.S. Geological Survey. Earthquake Catalog GeoJSON Feed.",
                List.of(
                        new PublicDatasetFile(
                                "geojson-feed",
                                "USGS earthquake GeoJSON feed",
                                FileFormat.GEOJSON,
                                SOURCE_URL,
                                sizeBytes(sourceFacts)),
                        new PublicDatasetFile(
                                "api-documentation",
                                "USGS FDSN event API documentation",
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
