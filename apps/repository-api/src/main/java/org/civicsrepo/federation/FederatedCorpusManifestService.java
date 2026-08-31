package org.civicsrepo.federation;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeSet;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

/** Builds deterministic, bounded manifests for retained federated source snapshots. */
@Service
public class FederatedCorpusManifestService {
    static final String MANIFEST_VERSION = "federated-corpus-manifest/v1";
    static final String BOUNDED_SNAPSHOT_VERSION = "federated-bounded-snapshot/v1";
    private static final byte[] HASH_VERSION = "federated-corpus-record/v1\n".getBytes(StandardCharsets.UTF_8);
    private static final int DEFAULT_SCAN_PAGE_SIZE = 1_000;

    private final FederatedMetadataCatalog catalog;
    private final HarvestRunStore runStore;
    private final ObjectMapper objectMapper;
    private final int scanPageSize;

    @Autowired
    public FederatedCorpusManifestService(FederatedMetadataCatalog catalog, HarvestRunStore runStore) {
        this(catalog, runStore, new ObjectMapper(), DEFAULT_SCAN_PAGE_SIZE);
    }

    FederatedCorpusManifestService(
            FederatedMetadataCatalog catalog,
            HarvestRunStore runStore,
            ObjectMapper objectMapper,
            int scanPageSize) {
        if (scanPageSize < 1 || scanPageSize > 10_000) {
            throw new IllegalArgumentException("scanPageSize must be between 1 and 10000");
        }
        this.catalog = catalog;
        this.runStore = runStore;
        this.objectMapper = objectMapper.copy().enable(SerializationFeature.ORDER_MAP_ENTRIES_BY_KEYS);
        this.scanPageSize = scanPageSize;
    }

    /**
     * Generates the retained source snapshot identity associated with a completed source run.
     *
     * <p>The content digest intentionally excludes {@link FederatedResearchRecord#harvestedAt()}.
     * Re-harvesting byte-for-byte equivalent normalized metadata at a later wall-clock time must
     * reproduce the same corpus identity. Run timestamps remain available separately in the
     * returned manifest.
     */
    public FederatedCorpusManifest generate(String runId) {
        HarvestRun run = requireRun(runId);
        if (run.status() != HarvestRunStatus.COMPLETED) {
            throw new IllegalStateException("Corpus manifests require a COMPLETED harvest run: " + run.id());
        }

        SnapshotScan scan = scanSource(run.sourceSystem());
        return new FederatedCorpusManifest(
                MANIFEST_VERSION,
                run.id(),
                run.sourceSystem(),
                run.adapterVersion(),
                scan.recordAdapterVersions(),
                scan.retainedRecordCount(),
                run.acceptedCount(),
                run.rejectedCount(),
                run.skippedCount(),
                scan.firstRecordId(),
                scan.lastRecordId(),
                scan.sha256(),
                scan.earliestSourceUpdatedAt(),
                scan.latestSourceUpdatedAt(),
                run.pageSize(),
                run.pageCount(),
                run.cursor(),
                run.startedAt(),
                run.completedAt());
    }

    /**
     * Captures deterministic evidence for a deliberately bounded checkpoint without claiming that
     * the external source was exhausted.
     *
     * <p>This is the manifest used for controlled 1K/10K/100K proofs. A {@link
     * HarvestRunStatus#PAUSED} run is expected and remains resumable. COMPLETED is also accepted so
     * the same evidence shape can describe a bounded source that happens to exhaust naturally.
     */
    public FederatedBoundedSnapshotManifest generateBoundedSnapshot(String runId) {
        return generateBoundedSnapshot(runId, Long.MAX_VALUE, OffsetDateTime.now(ZoneOffset.UTC));
    }

    /**
     * Captures the deterministic stable-ID prefix used by a named corpus profile.
     *
     * <p>The retained source may contain more records than the requested evidence tier. Bounding
     * the snapshot independently from publisher page boundaries keeps a 100K/1M checkpoint exact
     * and reproducible even when the final harvest page takes the retained corpus slightly past the
     * target.
     */
    public FederatedBoundedSnapshotManifest generateBoundedSnapshot(String runId, long recordLimit) {
        return generateBoundedSnapshot(runId, recordLimit, OffsetDateTime.now(ZoneOffset.UTC));
    }

    FederatedBoundedSnapshotManifest generateBoundedSnapshot(String runId, OffsetDateTime capturedAt) {
        return generateBoundedSnapshot(runId, Long.MAX_VALUE, capturedAt);
    }

    FederatedBoundedSnapshotManifest generateBoundedSnapshot(
            String runId, long recordLimit, OffsetDateTime capturedAt) {
        if (recordLimit < 1) {
            throw new IllegalArgumentException("recordLimit must be at least 1");
        }

        HarvestRun run = requireRun(runId);
        if (run.status() != HarvestRunStatus.PAUSED && run.status() != HarvestRunStatus.COMPLETED) {
            throw new IllegalStateException(
                    "Bounded snapshots require a PAUSED or COMPLETED harvest run: " + run.id());
        }

        SnapshotScan scan = scanSource(run.sourceSystem(), recordLimit);
        String snapshotId = run.sourceSystem().name() + ":" + scan.sha256();
        return new FederatedBoundedSnapshotManifest(
                BOUNDED_SNAPSHOT_VERSION,
                FederatedBoundedSnapshotManifest.MODE,
                snapshotId,
                run.id(),
                run.sourceSystem(),
                run.adapterVersion(),
                scan.recordAdapterVersions(),
                run.status(),
                scan.retainedRecordCount(),
                run.acceptedCount(),
                run.rejectedCount(),
                run.skippedCount(),
                scan.firstRecordId(),
                scan.lastRecordId(),
                scan.sha256(),
                scan.earliestSourceUpdatedAt(),
                scan.latestSourceUpdatedAt(),
                run.pageSize(),
                run.pageCount(),
                run.cursor(),
                run.startedAt(),
                run.updatedAt(),
                normalizeUtc(capturedAt));
    }

    private HarvestRun requireRun(String runId) {
        return runStore.findById(runId)
                .orElseThrow(() -> new IllegalArgumentException("Unknown harvest run " + runId));
    }

    private SnapshotScan scanSource(FederatedSourceSystem sourceSystem) {
        return scanSource(sourceSystem, Long.MAX_VALUE);
    }

    private SnapshotScan scanSource(FederatedSourceSystem sourceSystem, long recordLimit) {
        MessageDigest digest = sha256();
        digest.update(HASH_VERSION);

        String sourcePrefix = sourceSystem.name() + ":";
        String cursor = sourcePrefix;
        String firstRecordId = null;
        String lastRecordId = null;
        long retainedRecordCount = 0;
        OffsetDateTime earliestSourceUpdatedAt = null;
        OffsetDateTime latestSourceUpdatedAt = null;
        TreeSet<String> adapterVersions = new TreeSet<>();
        boolean sourceRangeComplete = false;

        while (!sourceRangeComplete && retainedRecordCount < recordLimit) {
            long remaining = recordLimit - retainedRecordCount;
            int pageLimit = (int) Math.min(scanPageSize, remaining);
            List<FederatedResearchRecord> page = catalog.findAfterId(cursor, pageLimit);
            if (page.isEmpty()) {
                break;
            }

            int sourceRecordsOnPage = 0;
            for (FederatedResearchRecord record : page) {
                if (record.sourceSystem() != sourceSystem) {
                    sourceRangeComplete = true;
                    break;
                }
                if (!record.id().startsWith(sourcePrefix)) {
                    throw new IllegalStateException(
                            "Federated record identity does not match source system: " + record.id());
                }

                digest.update(canonicalRecord(record));
                digest.update((byte) '\n');
                retainedRecordCount++;
                sourceRecordsOnPage++;
                adapterVersions.add(record.adapterVersion());
                if (firstRecordId == null) {
                    firstRecordId = record.id();
                }
                lastRecordId = record.id();
                cursor = record.id();

                OffsetDateTime sourceUpdatedAt = normalizeUtc(record.sourceUpdatedAt());
                if (sourceUpdatedAt != null) {
                    if (earliestSourceUpdatedAt == null || sourceUpdatedAt.isBefore(earliestSourceUpdatedAt)) {
                        earliestSourceUpdatedAt = sourceUpdatedAt;
                    }
                    if (latestSourceUpdatedAt == null || sourceUpdatedAt.isAfter(latestSourceUpdatedAt)) {
                        latestSourceUpdatedAt = sourceUpdatedAt;
                    }
                }

                if (retainedRecordCount >= recordLimit) {
                    break;
                }
            }

            if (sourceRangeComplete
                    || retainedRecordCount >= recordLimit
                    || page.size() < pageLimit
                    || sourceRecordsOnPage == 0) {
                break;
            }
        }

        return new SnapshotScan(
                List.copyOf(adapterVersions),
                retainedRecordCount,
                firstRecordId,
                lastRecordId,
                HexFormat.of().formatHex(digest.digest()),
                earliestSourceUpdatedAt,
                latestSourceUpdatedAt);
    }

    private byte[] canonicalRecord(FederatedResearchRecord record) {
        Map<String, Object> canonical = new LinkedHashMap<>();
        canonical.put("adapterVersion", record.adapterVersion());
        canonical.put("authors", record.authors());
        canonical.put("contentType", record.contentType().getValue());
        canonical.put("id", record.id());
        canonical.put("program", record.program());
        canonical.put("publisher", record.publisher());
        canonical.put("sourceIdentifier", record.sourceIdentifier());
        canonical.put("sourceMetadata", record.sourceMetadata());
        canonical.put("sourceSystem", record.sourceSystem().name());
        canonical.put(
                "sourceUpdatedAt",
                record.sourceUpdatedAt() == null ? null : record.sourceUpdatedAt().toInstant().toString());
        canonical.put("sourceUrl", record.sourceUrl().toString());
        canonical.put("subjects", record.subjects());
        canonical.put("summary", record.summary());
        canonical.put("title", record.title());
        try {
            return objectMapper.writeValueAsBytes(canonical);
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("Federated corpus record could not be canonicalized: " + record.id(), exception);
        }
    }

    private OffsetDateTime normalizeUtc(OffsetDateTime value) {
        return value == null ? null : OffsetDateTime.ofInstant(value.toInstant(), ZoneOffset.UTC);
    }

    private MessageDigest sha256() {
        try {
            return MessageDigest.getInstance("SHA-256");
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is unavailable.", exception);
        }
    }

    private record SnapshotScan(
            List<String> recordAdapterVersions,
            long retainedRecordCount,
            String firstRecordId,
            String lastRecordId,
            String sha256,
            OffsetDateTime earliestSourceUpdatedAt,
            OffsetDateTime latestSourceUpdatedAt) {}
}
