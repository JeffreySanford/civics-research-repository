package org.civicsrepo.dspace;

import java.util.List;
import java.util.Map;

public record DspaceItemPayload(
        String name, String type, Map<String, List<DspaceMetadataValue>> metadata, List<DspaceBitstreamPayload> bitstreams) {}
