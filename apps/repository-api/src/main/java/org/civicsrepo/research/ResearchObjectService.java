package org.civicsrepo.research;

import java.util.List;
import org.civicsrepo.datasets.DatasetService;
import org.civicsrepo.federation.FederatedMetadataCatalog;
import org.civicsrepo.generated.dto.ResearchArtifactVersion;
import org.civicsrepo.generated.dto.ResearchArtifactVersionHistory;
import org.civicsrepo.generated.dto.ResearchObjectDetail;
import org.civicsrepo.generated.dto.ResearchObjectOrigin;
import org.civicsrepo.generated.dto.VersionHistoryStatus;
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

    public ResearchArtifactVersionHistory getResearchObjectVersionHistory(String researchIdToken) {
        ResearchObjectDetail detail = getResearchObject(researchIdToken);

        ResearchArtifactVersion observed = detail.getOrigin() == ResearchObjectOrigin.REPOSITORY
                ? datasetService.findObservedRepositoryVersion(detail.getId())
                        .orElseGet(() -> observedFromDetail(detail))
                : observedFromDetail(detail);

        return new ResearchArtifactVersionHistory(
                        detail.getId(), VersionHistoryStatus.OBSERVED_CURRENT_ONLY, List.of(observed))
                .note("Only the current repository/source record has been observed; earlier or later version history is not established.");
    }

    /**
     * Authority-neutral fallback for federated/fixture records and a degraded DSpace read.
     *
     * <p>It deliberately carries only facts already present on the detail response. It does not
     * infer a source version label, checksum, capture time, or lineage from vintage/year naming.
     */
    private ResearchArtifactVersion observedFromDetail(ResearchObjectDetail detail) {
        return new ResearchArtifactVersion(detail.getId(), detail.getTitle())
                .current(true)
                .releasedOn(detail.getReleasedOn())
                .doi(detail.getDoi())
                .sourceUrl(detail.getSourceUrl());
    }
}
