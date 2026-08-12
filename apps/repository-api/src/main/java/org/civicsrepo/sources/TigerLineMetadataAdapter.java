package org.civicsrepo.sources;

import org.civicsrepo.generated.dto.FileFormat;
import org.civicsrepo.generated.dto.ResearchProgram;
import java.time.LocalDate;
import java.util.List;
import org.civicsrepo.sync.SyncSource;
import org.springframework.stereotype.Component;

@Component
public class TigerLineMetadataAdapter implements PublicMetadataAdapter {
    private static final int VINTAGE_YEAR = 2025;
    private static final String GEOGRAPHY = "North Dakota";
    private static final String STATE_FIPS = "38";
    private static final String TIGER_BASE_URL = "https://www2.census.gov/geo/tiger/TIGER2025/TRACT/";
    private static final String DOCUMENTATION_URL =
            "https://www.census.gov/geographies/mapping-files/time-series/geo/tiger-line-file.html";
    private static final String TECHNICAL_DOCUMENTATION_URL =
            "https://www2.census.gov/geo/pdfs/maps-data/data/tiger/tgrshp2025/TGRSHP2025_TechDoc.pdf";

    @Override
    public SyncSource source() {
        return SyncSource.TIGER_LINE;
    }

    @Override
    public PublicDatasetMetadata firstVisualSlice() {
        String sourceUrl = TIGER_BASE_URL + "tl_" + VINTAGE_YEAR + "_" + STATE_FIPS + "_tract.zip";
        return new PublicDatasetMetadata(
                "tiger-line-north-dakota-2025",
                "2025 TIGER/Line - Census Tracts - North Dakota",
                ResearchProgram.TIGER_LINE,
                "U.S. Census Bureau",
                "Cartographic boundary and tract geometry metadata for North Dakota census tracts, prepared as the first repository geospatial synchronization slice.",
                GEOGRAPHY,
                "Census tract",
                VINTAGE_YEAR,
                LocalDate.of(2025, 9, 23),
                sourceUrl,
                DOCUMENTATION_URL,
                "U.S. Census Bureau. 2025 TIGER/Line Shapefiles: Census Tracts, North Dakota.",
                List.of(
                        new PublicDatasetFile(
                                "source-zip",
                                "North Dakota census tract TIGER/Line shapefile archive",
                                FileFormat.ZIP,
                                sourceUrl,
                                null),
                        new PublicDatasetFile(
                                "technical-documentation",
                                "2025 TIGER/Line technical documentation",
                                FileFormat.PDF,
                                TECHNICAL_DOCUMENTATION_URL,
                                null),
                        new PublicDatasetFile(
                                "source-landing-page",
                                "TIGER/Line shapefile source landing page",
                                FileFormat.OTHER,
                                DOCUMENTATION_URL,
                                null)));
    }
}
