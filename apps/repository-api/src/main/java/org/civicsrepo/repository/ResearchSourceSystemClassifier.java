package org.civicsrepo.repository;

import org.civicsrepo.generated.dto.ResearchProgram;
import org.civicsrepo.generated.dto.SourceSystem;

/**
 * Maps the curated repository's program vocabulary to the controlled authoritative source family.
 *
 * <p>Origin and source system are deliberately independent. A Census research object may be
 * represented by DSpace ({@code REPOSITORY}) or by generated fallback content ({@code FIXTURE}),
 * but its authoritative source family is still {@code CENSUS}. Unknown program values remain
 * {@code OTHER}; provenance must never be guessed from a title or publisher string.
 */
public final class ResearchSourceSystemClassifier {
    private ResearchSourceSystemClassifier() {}

    public static SourceSystem forProgram(ResearchProgram program) {
        if (program == null) {
            return SourceSystem.OTHER;
        }

        return switch (program) {
            case USGS, USGS_3_DEP, USGS_3_HP -> SourceSystem.USGS;
            case ACS,
                    SIPP,
                    CPS,
                    LEHD,
                    LODES,
                    TIGER_LINE,
                    ECONOMIC_CENSUS,
                    COUNTY_BUSINESS_PATTERNS,
                    BUILDING_PERMITS,
                    POPULATION_ESTIMATES,
                    SAIPE,
                    BUSINESS_DYNAMICS -> SourceSystem.CENSUS;
            case OTHER -> SourceSystem.OTHER;
        };
    }
}
