package org.civicsrepo.research;

import org.civicsrepo.datasets.DatasetService;
import org.civicsrepo.federation.FederatedMetadataCatalog;
import org.civicsrepo.generated.dto.ResearchObjectDetail;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

/** Resolves one canonical research identity across curated and federated authorities. */
@Service
public final class ResearchObjectService {
    private final ResearchIdCodec researchIdCodec;
    private final FederatedMetadataCatalog federatedMetadataCatalog;
    private final FederatedResearchObjectMapper federatedMapper;
    private final DatasetService datasetService;

    public ResearchObjectService(
            ResearchIdCodec researchIdCodec,
            FederatedMetadataCatalog federatedMetadataCatalog,
            FederatedResearchObjectMapper federatedMapper,
            DatasetService datasetService) {
        this.researchIdCodec = researchIdCodec;
        this.federatedMetadataCatalog = federatedMetadataCatalog;
        this.federatedMapper = federatedMapper;
        this.datasetService = datasetService;
    }

    public ResearchObjectDetail getResearchObject(String researchIdToken) {
        final String canonicalId;
        try {
            canonicalId = researchIdCodec.decode(researchIdToken);
        } catch (IllegalArgumentException exception) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid research identity.", exception);
        }

        return federatedMetadataCatalog
                .findById(canonicalId)
                .map(federatedMapper::toDetail)
                .orElseGet(() -> datasetService.getDataset(canonicalId));
    }
}
