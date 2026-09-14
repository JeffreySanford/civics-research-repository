package org.civicsrepo.dspace;

import org.civicsrepo.generated.dto.SyncAction;
import org.civicsrepo.sources.OfflineSourceFileProbe;
import static org.assertj.core.api.Assertions.assertThat;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.civicsrepo.sources.TigerLineMetadataAdapter;
import org.civicsrepo.sources.CatalogMetadataReader;
import org.junit.jupiter.api.Test;

class DspaceItemDiffPlannerTest {
    private final DspaceItemPayload sourcePayload =
            new DspaceItemPayloadMapper().toItemPayload(new TigerLineMetadataAdapter(new OfflineSourceFileProbe(), new CatalogMetadataReader()).firstVisualSlice());

    @Test
    void createsItemWhenNoExistingRepositoryPayloadIsFound() {
        SyncAction action = plannerFor(Optional.empty()).planItemDiff("tiger-line-north-dakota-2025", sourcePayload);

        assertThat(action.getActionType()).isEqualTo(SyncAction.ActionTypeEnum.CREATE_ITEM);
        assertThat(action.getDetail()).contains("does not exist");
    }

    @Test
    void skipsItemWhenRepositoryPayloadMatchesSourcePayload() {
        SyncAction action =
                plannerFor(Optional.of(sourcePayload)).planItemDiff("tiger-line-north-dakota-2025", sourcePayload);

        assertThat(action.getActionType()).isEqualTo(SyncAction.ActionTypeEnum.SKIP_ITEM);
        assertThat(action.getDetail()).contains("is current");
    }

    /**
     * DSpace returns bookkeeping metadata no source payload will ever carry. Comparing whole items
     * made SKIP_ITEM unreachable, so only the managed fields are compared.
     */
    @Test
    void ignoresDspaceOwnedMetadataThatSynchronizationDoesNotManage() {
        DspaceItemPayload repositoryPayload = withMetadata(
                sourcePayload,
                Map.of(
                        "dc.date.accessioned", values("2026-08-12T00:00:00Z"),
                        "dc.description.provenance", values("Submitted by admin@civics.local"),
                        "dc.type", values("Dataset")));

        SyncAction action =
                plannerFor(Optional.of(repositoryPayload)).planItemDiff("tiger-line-north-dakota-2025", sourcePayload);

        assertThat(action.getActionType()).isEqualTo(SyncAction.ActionTypeEnum.SKIP_ITEM);
    }

    @Test
    void ignoresRepositoryAddedIdentifierUriWhenSourceUriRemainsPresent() {
        List<DspaceMetadataValue> identifierUris =
                new ArrayList<>(sourcePayload.metadata().get("dc.identifier.uri"));
        identifierUris.add(new DspaceMetadataValue(
                "http://localhost:4000/handle/123456789/160.2", null, null, -1));
        DspaceItemPayload repositoryPayload =
                withMetadata(sourcePayload, Map.of("dc.identifier.uri", List.copyOf(identifierUris)));

        SyncAction action =
                plannerFor(Optional.of(repositoryPayload)).planItemDiff("tiger-line-north-dakota-2025", sourcePayload);

        assertThat(action.getActionType()).isEqualTo(SyncAction.ActionTypeEnum.SKIP_ITEM);
    }

    @Test
    void updatesWhenSourceIdentifierUriIsMissingEvenIfRepositoryHandleExists() {
        DspaceItemPayload repositoryPayload = withMetadata(
                sourcePayload,
                Map.of(
                        "dc.identifier.uri",
                        List.of(new DspaceMetadataValue(
                                "http://localhost:4000/handle/123456789/160.2", null, null, -1))));

        SyncAction action =
                plannerFor(Optional.of(repositoryPayload)).planItemDiff("tiger-line-north-dakota-2025", sourcePayload);

        assertThat(action.getActionType()).isEqualTo(SyncAction.ActionTypeEnum.UPDATE_ITEM);
        assertThat(action.getDetail()).contains("dc.identifier.uri");
    }

    @Test
    void updatesItemWhenAManagedFieldDiffers() {
        DspaceItemPayload repositoryPayload =
                withMetadata(sourcePayload, Map.of("dc.title", values("An older title")));

        SyncAction action =
                plannerFor(Optional.of(repositoryPayload)).planItemDiff("tiger-line-north-dakota-2025", sourcePayload);

        assertThat(action.getActionType()).isEqualTo(SyncAction.ActionTypeEnum.UPDATE_ITEM);
        assertThat(action.getDetail()).contains("dc.title").contains("1 managed field");
    }

    /** The file manifest is the reason diff previously could never settle; it is now comparable. */
    @Test
    void updatesItemWhenTheFileManifestIsMissingFromTheRepository() {
        Map<String, List<DspaceMetadataValue>> withoutManifest = new LinkedHashMap<>(sourcePayload.metadata());
        withoutManifest.remove(DspaceFileManifest.FIELD);
        DspaceItemPayload repositoryPayload = new DspaceItemPayload(
                sourcePayload.name(), sourcePayload.type(), Map.copyOf(withoutManifest), List.of());

        SyncAction action =
                plannerFor(Optional.of(repositoryPayload)).planItemDiff("tiger-line-north-dakota-2025", sourcePayload);

        assertThat(action.getActionType()).isEqualTo(SyncAction.ActionTypeEnum.UPDATE_ITEM);
        assertThat(action.getDetail()).contains(DspaceFileManifest.FIELD);
    }

    @Test
    void updatesItemWhenOneManifestEntryChanged() {
        List<DspaceMetadataValue> manifest = sourcePayload.metadata().get(DspaceFileManifest.FIELD);
        List<DspaceMetadataValue> changed = new java.util.ArrayList<>(manifest);
        changed.set(0, new DspaceMetadataValue("{\"id\":\"stale\",\"url\":\"https://example.gov/old.zip\"}", "en_US", null, -1));

        SyncAction action = plannerFor(Optional.of(withMetadata(sourcePayload, Map.of(DspaceFileManifest.FIELD, changed))))
                .planItemDiff("tiger-line-north-dakota-2025", sourcePayload);

        assertThat(action.getActionType()).isEqualTo(SyncAction.ActionTypeEnum.UPDATE_ITEM);
        assertThat(action.getDetail()).contains(DspaceFileManifest.FIELD);
    }

    /** The repository holding extra values for an unmanaged field is not a difference. */
    @Test
    void doesNotReportAFieldTheSourcePayloadLeavesEmpty() {
        Map<String, List<DspaceMetadataValue>> sparse = new LinkedHashMap<>(sourcePayload.metadata());
        sparse.remove("dc.subject");
        DspaceItemPayload sparseSource =
                new DspaceItemPayload(sourcePayload.name(), sourcePayload.type(), Map.copyOf(sparse), sourcePayload.bitstreams());

        SyncAction action =
                plannerFor(Optional.of(sourcePayload)).planItemDiff("tiger-line-north-dakota-2025", sparseSource);

        assertThat(action.getActionType()).isEqualTo(SyncAction.ActionTypeEnum.SKIP_ITEM);
    }

    @Test
    void skipsWhenStructuredAccessGuidanceMatchesRepository() {
        DspaceItemPayload structuredSource = withMetadata(
                sourcePayload,
                Map.of(
                        DspaceManagedFields.ACCESS_URL_FIELD,
                        values("https://www.census.gov/about/adrm/fsrdc.html")));

        SyncAction action = plannerFor(Optional.of(structuredSource))
                .planItemDiff("tiger-line-north-dakota-2025", structuredSource);

        assertThat(action.getActionType()).isEqualTo(SyncAction.ActionTypeEnum.SKIP_ITEM);
    }

    @Test
    void updatesWhenStructuredAccessGuidanceChanges() {
        DspaceItemPayload structuredSource = withMetadata(
                sourcePayload,
                Map.of(
                        DspaceManagedFields.ACCESS_URL_FIELD,
                        values("https://www.census.gov/about/adrm/fsrdc.html")));
        DspaceItemPayload repositoryPayload = withMetadata(
                structuredSource,
                Map.of(
                        DspaceManagedFields.ACCESS_URL_FIELD,
                        values("https://example.gov/old-access-path")));

        SyncAction action = plannerFor(Optional.of(repositoryPayload))
                .planItemDiff("tiger-line-north-dakota-2025", structuredSource);

        assertThat(action.getActionType()).isEqualTo(SyncAction.ActionTypeEnum.UPDATE_ITEM);
        assertThat(action.getDetail()).contains(DspaceManagedFields.ACCESS_URL_FIELD);
    }

    @Test
    void sourceWithoutStructuredGuidanceDoesNotClearRepositoryGuidance() {
        DspaceItemPayload repositoryPayload = withMetadata(
                sourcePayload,
                Map.of(
                        DspaceManagedFields.ACCESS_URL_FIELD,
                        values("https://www.census.gov/about/adrm/fsrdc.html")));

        SyncAction action =
                plannerFor(Optional.of(repositoryPayload)).planItemDiff("tiger-line-north-dakota-2025", sourcePayload);

        assertThat(action.getActionType()).isEqualTo(SyncAction.ActionTypeEnum.SKIP_ITEM);
    }

    private DspaceItemDiffPlanner plannerFor(Optional<DspaceItemPayload> existing) {
        return new DspaceItemDiffPlanner((sourceIdentifier) -> existing);
    }

    private DspaceItemPayload withMetadata(
            DspaceItemPayload payload, Map<String, List<DspaceMetadataValue>> overrides) {
        Map<String, List<DspaceMetadataValue>> metadata = new LinkedHashMap<>(payload.metadata());
        metadata.putAll(overrides);
        return new DspaceItemPayload(payload.name(), payload.type(), Map.copyOf(metadata), payload.bitstreams());
    }

    private List<DspaceMetadataValue> values(String value) {
        return List.of(new DspaceMetadataValue(value, "en_US", null, -1));
    }
}
