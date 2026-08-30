package org.civicsrepo.repository;

import static org.assertj.core.api.Assertions.assertThat;

import org.civicsrepo.generated.dto.ResearchProgram;
import org.civicsrepo.generated.dto.SourceSystem;
import org.junit.jupiter.api.Test;

class ResearchSourceSystemClassifierTest {

    @Test
    void classifiesCensusProgramsWithoutGuessingFromLabels() {
        assertThat(ResearchSourceSystemClassifier.forProgram(ResearchProgram.ACS)).isEqualTo(SourceSystem.CENSUS);
        assertThat(ResearchSourceSystemClassifier.forProgram(ResearchProgram.LODES)).isEqualTo(SourceSystem.CENSUS);
        assertThat(ResearchSourceSystemClassifier.forProgram(ResearchProgram.SAIPE)).isEqualTo(SourceSystem.CENSUS);
    }

    @Test
    void classifiesUsgsProgramsAsUsgs() {
        assertThat(ResearchSourceSystemClassifier.forProgram(ResearchProgram.USGS)).isEqualTo(SourceSystem.USGS);
        assertThat(ResearchSourceSystemClassifier.forProgram(ResearchProgram.USGS_3_DEP)).isEqualTo(SourceSystem.USGS);
        assertThat(ResearchSourceSystemClassifier.forProgram(ResearchProgram.USGS_3_HP)).isEqualTo(SourceSystem.USGS);
    }

    @Test
    void leavesUnknownProgramsExplicitlyUnknown() {
        assertThat(ResearchSourceSystemClassifier.forProgram(ResearchProgram.OTHER)).isEqualTo(SourceSystem.OTHER);
        assertThat(ResearchSourceSystemClassifier.forProgram(null)).isEqualTo(SourceSystem.OTHER);
    }
}
