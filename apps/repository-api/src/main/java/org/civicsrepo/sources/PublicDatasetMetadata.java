package org.civicsrepo.sources;

import java.time.LocalDate;
import java.util.List;
import org.civicsrepo.search.ResearchProgram;

public record PublicDatasetMetadata(
        String id,
        String title,
        ResearchProgram program,
        String publisher,
        String summary,
        String geography,
        String geographicLevel,
        Integer vintageYear,
        LocalDate releasedOn,
        String sourceUrl,
        String documentationUrl,
        String citation,
        List<PublicDatasetFile> files) {}
