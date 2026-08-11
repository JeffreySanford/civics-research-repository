package org.civicsrepo.datasets;

import java.time.LocalDate;
import java.util.List;
import org.civicsrepo.search.ResearchProgram;

public record DatasetDetail(
        String id,
        String title,
        ResearchProgram program,
        String publisher,
        String abstractText,
        String geography,
        Integer vintageYear,
        LocalDate releasedOn,
        List<DatasetFile> files,
        String citation,
        String sourceUrl,
        EvidenceStatus accessibilityEvidenceStatus) {}
