package org.civicsrepo.datasets;

import java.time.LocalDate;
import java.util.List;
import org.civicsrepo.generated.dto.ResearchProgram;
import org.civicsrepo.generated.dto.SearchResult;
import org.civicsrepo.generated.dto.RepositorySource;

/**
 * @param source whether this record came from DSpace or from the fixture catalog.
 */
public record DatasetDetail(
        RepositorySource source,
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
        EvidenceStatus accessibilityEvidenceStatus,
        List<SearchResult> relatedResearch) {}
