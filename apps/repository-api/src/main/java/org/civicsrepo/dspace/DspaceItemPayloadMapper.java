package org.civicsrepo.dspace;

import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;
import org.civicsrepo.sources.PublicDatasetFile;
import org.civicsrepo.sources.PublicDatasetMetadata;
import org.springframework.stereotype.Component;

@Component
public class DspaceItemPayloadMapper {
    private static final String LANGUAGE = "en_US";

    public DspaceItemPayload toItemPayload(PublicDatasetMetadata metadata) {
        return new DspaceItemPayload(
                metadata.title(),
                "item",
                Map.ofEntries(
                        entry("dc.title", metadata.title()),
                        entry("dc.contributor.author", metadata.publisher()),
                        entry("dc.publisher", metadata.publisher()),
                        entry("dc.description.abstract", metadata.summary()),
                        entry("dc.date.issued", metadata.releasedOn().format(DateTimeFormatter.ISO_LOCAL_DATE)),
                        entry("dc.identifier.uri", metadata.sourceUrl()),
                        entry("dc.relation.uri", metadata.documentationUrl()),
                        entry("dc.identifier.citation", metadata.citation()),
                        entry("dc.subject", metadata.program().name()),
                        entry("dc.coverage.spatial", metadata.geography()),
                        entry("crr.identifier.source", metadata.id()),
                        entry("crr.program", metadata.program().name()),
                        entry("crr.geography.level", metadata.geographicLevel()),
                        entry("crr.vintage", metadata.vintageYear().toString()),
                        entry("crr.source.url", metadata.sourceUrl()),
                        entry("crr.documentation.url", metadata.documentationUrl())),
                metadata.files().stream().map(this::toBitstreamPayload).toList());
    }

    private Map.Entry<String, List<DspaceMetadataValue>> entry(String field, String value) {
        return Map.entry(field, List.of(new DspaceMetadataValue(value, LANGUAGE, null, -1)));
    }

    private DspaceBitstreamPayload toBitstreamPayload(PublicDatasetFile file) {
        return new DspaceBitstreamPayload(file.label(), "ORIGINAL", file.format(), file.url(), file.sizeBytes());
    }
}
