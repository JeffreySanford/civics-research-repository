package org.civicsrepo.federation;

import java.util.Locale;
import java.util.Map;
import org.civicsrepo.generated.dto.ResearchObjectOrigin;
import org.civicsrepo.generated.dto.ResearchProgram;
import org.civicsrepo.generated.dto.SearchResult;
import org.civicsrepo.generated.dto.SourceSystem;
import org.civicsrepo.search.DiscoveryDocument;
import org.springframework.stereotype.Component;

/** Converts normalized federated metadata into the engine-neutral discovery projection shape. */
@Component
public class FederatedDiscoveryDocumentMapper {

    public DiscoveryDocument toDiscoveryDocument(FederatedResearchRecord record) {
        SearchResult result = new SearchResult(
                        record.id(),
                        record.title(),
                        record.contentType(),
                        ResearchProgram.OTHER,
                        record.publisher(),
                        record.summary(),
                        record.sourceUrl(),
                        ResearchObjectOrigin.FEDERATED,
                        sourceSystem(record.sourceSystem()))
                .programName(record.program());

        return new DiscoveryDocument(
                result,
                record.program(),
                record.subjects(),
                record.authors(),
                metadataText(record.sourceMetadata(), "citation"),
                metadataText(record.sourceMetadata(), "doi"));
    }

    private SourceSystem sourceSystem(FederatedSourceSystem sourceSystem) {
        return SourceSystem.fromValue(sourceSystem.name());
    }

    private String metadataText(Map<String, Object> metadata, String key) {
        if (metadata == null || metadata.isEmpty()) {
            return null;
        }
        Object direct = metadata.get(key);
        if (direct == null) {
            direct = metadata.get(key.toUpperCase(Locale.ROOT));
        }
        if (direct == null) {
            return null;
        }
        String value = String.valueOf(direct).trim();
        return value.isEmpty() ? null : value;
    }
}
