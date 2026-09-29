package org.civicsrepo.research;

import java.util.List;
import org.civicsrepo.datasets.DatasetService;
import org.civicsrepo.federation.FederatedMetadataCatalog;
import org.civicsrepo.generated.dto.ResearchArtifactVersion;
import org.civicsrepo.generated.dto.ResearchArtifactVersionHistory;
import org.civicsrepo.generated.dto.ResearchObjectDetail;
import org.civicsrepo.generated.dto.VersionHistoryStatus;
import org.civicsrepo.metadata.ResearchMetadataProfile;
import org.civicsrepo.metadata.ResearchMetadataProfileAssembler;
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
    private final ResearchMetadataProfileAssembler researchMetadataProfileAssembler;

    public ResearchObjectService(
            ResearchIdCodec researchIdCodec,
            FederatedMetadataCatalog federatedMetadataCatalog,
            FederatedResearchObjectMapper federatedMapper,
            DatasetService datasetService,
            ResearchMetadataProfileAssembler researchMetadataProfileAssembler) {
        this.researchIdCodec = researchIdCodec;
        this.federatedMetadataCatalog = federatedMetadataCatalog;
        this.federatedMapper = federatedMapper;
        this.datasetService = datasetService;
        this.researchMetadataProfileAssembler = researchMetadataProfileAssembler;
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
        return buildVersionHistory(getResearchObject(researchIdToken));
    }

    /**
     * Returns the immutable application metadata authority for one canonical research identity.
     *
     * <p>The detail is resolved exactly once, and version authority is derived from that same
     * resolved identity before the generated DTOs are copied into the immutable profile.
     */
    public ResearchMetadataProfile getResearchMetadataProfile(String researchIdToken) {
        ResearchObjectDetail detail = getResearchObject(researchIdToken);
        return researchMetadataProfileAssembler.assemble(detail, buildVersionHistory(detail));
    }

    private ResearchArtifactVersionHistory buildVersionHistory(ResearchObjectDetail detail) {
        // Detail presentation may resolve through a federated authority first, but DSpace remains
        // authoritative for repository version evidence when the same canonical identity is held.
        List<ResearchArtifactVersion> repositoryVersions =
                datasetService.findObservedRepositoryVersionHistory(detail.getId());
        List<ResearchArtifactVersion> versions = repositoryVersions.isEmpty()
                ? List.of(observedFromDetail(detail))
                : repositoryVersions;

        VersionHistoryStatus status = versions.size() > 1
                ? VersionHistoryStatus.HISTORY_AVAILABLE
                : VersionHistoryStatus.OBSERVED_CURRENT_ONLY;
        String note = status == VersionHistoryStatus.HISTORY_AVAILABLE
                ? "Multiple repository versions have been observed in DSpace; lineage reflects DSpace-native version history."
                : "Only the current repository/source record has been observed; earlier or later version history is not established.";

        return new ResearchArtifactVersionHistory(detail.getId(), status, versions).note(note);
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
