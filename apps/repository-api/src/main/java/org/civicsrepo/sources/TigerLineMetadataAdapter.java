package org.civicsrepo.sources;

import org.civicsrepo.generated.dto.SyncSource;
import org.civicsrepo.generated.dto.FileFormat;
import org.civicsrepo.generated.dto.ResearchProgram;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import org.springframework.stereotype.Component;

/**
 * TIGER/Line metadata for the first repository synchronization slice.
 *
 * <p>Which file this describes is a decision, and stays compiled in. What the file currently is --
 * how large, and when the Census Bureau last published it -- is a fact about the file, and is read
 * from the publishing host rather than compiled in, because a compiled size is wrong the moment the
 * Bureau reissues the archive.
 *
 * <p>When the host cannot be reached the compiled release date is used and sizes are left absent.
 * A sync must not fail, or hang, because census.gov is slow.
 */
@Component
public class TigerLineMetadataAdapter implements PublicMetadataAdapter {
    private static final int VINTAGE_YEAR = 2025;
    private static final String GEOGRAPHY = "North Dakota";
    private static final String STATE_FIPS = "38";
    private static final String TIGER_BASE_URL = "https://www2.census.gov/geo/tiger/TIGER2025/TRACT/";
    private static final String DOCUMENTATION_URL =
            "https://www.census.gov/geographies/mapping-files/time-series/geo/tiger-line-file.html";
    /** Used when the publisher is unreachable or sends no Last-Modified. */
    private static final LocalDate FALLBACK_RELEASED_ON = LocalDate.of(2025, 9, 23);

    private static final String TECHNICAL_DOCUMENTATION_URL =
            "https://www2.census.gov/geo/pdfs/maps-data/data/tiger/tgrshp2025/TGRSHP2025_TechDoc.pdf";

    private final SourceFileProbe sourceFileProbe;
    private final CatalogMetadataReader catalogMetadataReader;

    public TigerLineMetadataAdapter(SourceFileProbe sourceFileProbe, CatalogMetadataReader catalogMetadataReader) {
        this.catalogMetadataReader = catalogMetadataReader;
        this.sourceFileProbe = sourceFileProbe;
    }

    @Override
    public SyncSource source() {
        return SyncSource.TIGER_LINE;
    }

    /**
     * Every area this program publishes, from the catalog.
     *
     * <p>TIGER_LINE accounts for a large share of the repository on its own, and reconciling a single
     * area left the rest with no recorded repository identity at all. Sizes and release dates still
     * come from the publisher; which objects exist comes from the catalog, so an adapter and the
     * seeded repository cannot disagree about that.
     */
    @Override
    public List<ResearchObjectMetadata> harvest() {
        List<ResearchObjectMetadata> objects = catalogMetadataReader.forProgram(ResearchProgram.TIGER_LINE);
        return objects.isEmpty() ? List.of(firstVisualSlice()) : objects;
    }

    @Override
    public ResearchObjectMetadata firstVisualSlice() {
        String sourceUrl = TIGER_BASE_URL + "tl_" + VINTAGE_YEAR + "_" + STATE_FIPS + "_tract.zip";
        Optional<SourceFileFacts> sourceFacts = sourceFileProbe.probe(sourceUrl);
        Optional<SourceFileFacts> documentationFacts = sourceFileProbe.probe(TECHNICAL_DOCUMENTATION_URL);

        return ResearchObjectMetadata.dataset(
                "tiger-line-north-dakota-2025",
                "2025 TIGER/Line - Census Tracts - North Dakota",
                ResearchProgram.TIGER_LINE,
                "U.S. Census Bureau",
                "Cartographic boundary and tract geometry metadata for North Dakota census tracts, prepared as the first repository geospatial synchronization slice.",
                GEOGRAPHY,
                "Census tract",
                VINTAGE_YEAR,
                releasedOn(sourceFacts),
                sourceUrl,
                DOCUMENTATION_URL,
                "U.S. Census Bureau. 2025 TIGER/Line Shapefiles: Census Tracts, North Dakota.",
                List.of(
                        new ResearchObjectFile(
                                "source-zip",
                                "North Dakota census tract TIGER/Line shapefile archive",
                                FileFormat.ZIP,
                                sourceUrl,
                                sizeBytes(sourceFacts)),
                        new ResearchObjectFile(
                                "technical-documentation",
                                "2025 TIGER/Line technical documentation",
                                FileFormat.PDF,
                                TECHNICAL_DOCUMENTATION_URL,
                                sizeBytes(documentationFacts)),
                        new ResearchObjectFile(
                                "source-landing-page",
                                "TIGER/Line shapefile source landing page",
                                FileFormat.OTHER,
                                DOCUMENTATION_URL,
                                // A landing page, not a file. Its byte count would mean nothing.
                                null)));
    }

    /** The publisher's Last-Modified when it offers one, otherwise the compiled release date. */
    private LocalDate releasedOn(Optional<SourceFileFacts> facts) {
        return facts.map(SourceFileFacts::lastModified).orElse(null) == null
                ? FALLBACK_RELEASED_ON
                : facts.orElseThrow().lastModified();
    }

    private Long sizeBytes(Optional<SourceFileFacts> facts) {
        return facts.map(SourceFileFacts::sizeBytes).orElse(null);
    }
}
