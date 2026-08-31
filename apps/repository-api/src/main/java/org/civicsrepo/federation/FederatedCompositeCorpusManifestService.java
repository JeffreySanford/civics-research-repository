package org.civicsrepo.federation;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.HexFormat;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

/** Builds and persists deterministic identities for explicitly composed multi-source corpora. */
@Service
public class FederatedCompositeCorpusManifestService {
    static final String COMPOSITION_VERSION = "federated-composition/v1";
    private static final byte[] HASH_VERSION = "federated-composition-digest/v1\n".getBytes(StandardCharsets.UTF_8);

    private final FederatedBoundedSnapshotManifestStore snapshotStore;
    private final FederatedCompositeCorpusManifestStore compositeStore;
    private final ObjectMapper objectMapper;

    @Autowired
    public FederatedCompositeCorpusManifestService(
            FederatedBoundedSnapshotManifestStore snapshotStore,
            FederatedCompositeCorpusManifestStore compositeStore) {
        this(snapshotStore, compositeStore, new ObjectMapper());
    }

    FederatedCompositeCorpusManifestService(
            FederatedBoundedSnapshotManifestStore snapshotStore,
            FederatedCompositeCorpusManifestStore compositeStore,
            ObjectMapper objectMapper) {
        this.snapshotStore = snapshotStore;
        this.compositeStore = compositeStore;
        this.objectMapper = objectMapper.copy().enable(SerializationFeature.ORDER_MAP_ENTRIES_BY_KEYS);
    }

    public FederatedCompositeCorpusManifest capture(
            CorpusProfile corpusProfile, List<FederatedCompositeCorpusSourceRequest> sourceRequests) {
        return capture(corpusProfile, sourceRequests, OffsetDateTime.now(ZoneOffset.UTC));
    }

    FederatedCompositeCorpusManifest capture(
            CorpusProfile corpusProfile,
            List<FederatedCompositeCorpusSourceRequest> sourceRequests,
            OffsetDateTime capturedAt) {
        if (corpusProfile == null) {
            throw new IllegalArgumentException("corpusProfile is required");
        }
        long targetRecordCount = corpusProfile
                .targetRecordCount()
                .orElseThrow(() -> new IllegalArgumentException(
                        "Composite corpus evidence requires a profile with an explicit federated record target"));
        if (sourceRequests == null || sourceRequests.size() < 2) {
            throw new IllegalArgumentException("Composite corpus evidence requires at least two source requests");
        }

        Set<FederatedSourceSystem> selectedSources = new HashSet<>();
        List<FederatedCompositeCorpusSourceRequest> orderedRequests = sourceRequests.stream()
                .sorted(Comparator.comparing(request -> request.sourceSystem().name()))
                .toList();
        List<FederatedCompositeCorpusSource> sources = orderedRequests.stream()
                .map(request -> resolveSource(request, selectedSources))
                .toList();

        long federatedRecordCount = 0;
        for (FederatedCompositeCorpusSource source : sources) {
            federatedRecordCount = Math.addExact(federatedRecordCount, source.retainedRecordCount());
        }
        if (federatedRecordCount != targetRecordCount) {
            throw new IllegalStateException("Composite source quotas total "
                    + federatedRecordCount
                    + " records but "
                    + corpusProfile.name()
                    + " requires "
                    + targetRecordCount);
        }

        String compositionSha256 = compositionSha256(corpusProfile, sources);
        FederatedCompositeCorpusManifest manifest = new FederatedCompositeCorpusManifest(
                COMPOSITION_VERSION,
                FederatedCompositeCorpusManifest.MODE,
                corpusProfile,
                sources,
                federatedRecordCount,
                compositionSha256,
                normalizeUtc(capturedAt));
        compositeStore.save(manifest);
        return manifest;
    }

    private FederatedCompositeCorpusSource resolveSource(
            FederatedCompositeCorpusSourceRequest request, Set<FederatedSourceSystem> selectedSources) {
        if (!selectedSources.add(request.sourceSystem())) {
            throw new IllegalArgumentException("Duplicate composite source " + request.sourceSystem().name());
        }

        FederatedBoundedSnapshotManifest snapshot = snapshotStore
                .findBySnapshotId(request.snapshotId())
                .orElseThrow(() -> new IllegalArgumentException(
                        "Unknown bounded snapshot " + request.snapshotId()));
        if (snapshot.sourceSystem() != request.sourceSystem()) {
            throw new IllegalArgumentException("Snapshot "
                    + snapshot.snapshotId()
                    + " belongs to "
                    + snapshot.sourceSystem().name()
                    + " rather than "
                    + request.sourceSystem().name());
        }
        if (snapshot.retainedRecordCount() != request.requestedRecordCount()) {
            throw new IllegalStateException("Snapshot "
                    + snapshot.snapshotId()
                    + " retains "
                    + snapshot.retainedRecordCount()
                    + " records but the composition requests "
                    + request.requestedRecordCount());
        }

        return new FederatedCompositeCorpusSource(
                snapshot.sourceSystem(),
                request.requestedRecordCount(),
                snapshot.snapshotId(),
                snapshot.runId(),
                snapshot.runAdapterVersion(),
                snapshot.recordAdapterVersions(),
                snapshot.retainedRecordCount(),
                snapshot.sha256(),
                snapshot.capturedAt());
    }

    private String compositionSha256(
            CorpusProfile corpusProfile, List<FederatedCompositeCorpusSource> sources) {
        Map<String, Object> canonical = new LinkedHashMap<>();
        canonical.put("compositionVersion", COMPOSITION_VERSION);
        canonical.put("corpusProfile", corpusProfile.name());
        canonical.put(
                "sources",
                sources.stream()
                        .map(source -> {
                            Map<String, Object> entry = new LinkedHashMap<>();
                            entry.put("requestedRecordCount", source.requestedRecordCount());
                            entry.put("sha256", source.sha256());
                            entry.put("snapshotId", source.snapshotId());
                            entry.put("sourceSystem", source.sourceSystem().name());
                            return entry;
                        })
                        .toList());

        MessageDigest digest = sha256();
        digest.update(HASH_VERSION);
        try {
            digest.update(objectMapper.writeValueAsBytes(canonical));
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("Composite corpus evidence could not be canonicalized", exception);
        }
        return HexFormat.of().formatHex(digest.digest());
    }

    private OffsetDateTime normalizeUtc(OffsetDateTime value) {
        if (value == null) {
            throw new IllegalArgumentException("capturedAt is required");
        }
        return OffsetDateTime.ofInstant(value.toInstant(), ZoneOffset.UTC);
    }

    private MessageDigest sha256() {
        try {
            return MessageDigest.getInstance("SHA-256");
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is unavailable.", exception);
        }
    }
}
