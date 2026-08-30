package org.civicsrepo.research;

import java.util.List;
import java.util.Map;
import org.civicsrepo.federation.FederatedResearchRecord;
import org.civicsrepo.generated.dto.RepositorySource;
import org.civicsrepo.generated.dto.ResearchAuthor;
import org.civicsrepo.generated.dto.ResearchObjectDetail;
import org.civicsrepo.generated.dto.ResearchObjectOrigin;
import org.civicsrepo.generated.dto.ResearchProgram;
import org.civicsrepo.generated.dto.SourceSystem;
import org.springframework.stereotype.Component;

/** Maps retained federated metadata into the authority-neutral public detail contract. */
@Component
public final class FederatedResearchObjectMapper {

    public ResearchObjectDetail toDetail(FederatedResearchRecord record) {
        ResearchObjectDetail detail = new ResearchObjectDetail(
                        RepositorySource.FEDERATED,
                        record.id(),
                        record.title(),
                        ResearchProgram.OTHER,
                        record.publisher(),
                        record.summary(),
                        List.of(),
                        citation(record),
                        record.sourceUrl(),
                        List.of(),
                        ResearchObjectOrigin.FEDERATED,
                        SourceSystem.fromValue(record.sourceSystem().name()))
                .programName(blankToNull(record.program()))
                .contentType(record.contentType())
                .authors(record.authors().stream().map(ResearchAuthor::new).toList());

        if (record.sourceUpdatedAt() != null) {
            detail.setReleasedOn(record.sourceUpdatedAt().toLocalDate());
        }
        metadataText(record.sourceMetadata(), "license").ifPresent(detail::setLicense);
        metadataText(record.sourceMetadata(), "doi").ifPresent(detail::setDoi);
        return detail;
    }

    private static String citation(FederatedResearchRecord record) {
        return metadataText(record.sourceMetadata(), "citation").orElse(record.title());
    }

    private static java.util.Optional<String> metadataText(Map<String, Object> metadata, String key) {
        Object value = metadata.get(key);
        if (!(value instanceof String text) || text.isBlank()) {
            return java.util.Optional.empty();
        }
        return java.util.Optional.of(text.trim());
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value;
    }
}
