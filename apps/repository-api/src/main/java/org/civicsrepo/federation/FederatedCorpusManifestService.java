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
     * Generates the retained source snapshot identity associated with a completed bounded run.
     *
     * <p>The content digest intentionally excludes {@link FederatedResearchRecord#harvestedAt()}.
     * Re-harvesting byte-for-byte equivalent normalized metadata at a later wall-clock time must
     * reproduce the same corpus identity. Run timestamps remain available separately in the
     * returned manifest.
     */
    public FederatedCorpusManifest generate(String runId) {
        HarvestRun run = runStore.findById(runId)
                .orElseThrow(() -> new IllegalArgumentException("Unknown harvest run " + runId));
        if (run.status() != HarvestRunStatus.COMPLETED) {
            throw new IllegalStateException("Corpus manifests require a COMPLETED harvest run: " + run.id());
        }

        MessageDigest digest = sha256();
        digest.update(HASH_VERSION);

        String sourcePrefix = run.sourceSystem().name() + ":";
        String cursor = sourcePrefix;
        String firstRecordId = null;
        String lastRecordId = null;
        long retainedRecordCount = 0;
        OffsetDateTime earliestSourceUpdatedAt = null;
        OffsetDateTime latestSourceUpdatedAt = null;
        TreeSet<String> adapterVersions = new TreeSet<>();
        boolean sourceRangeComplete = false;

        while (!sourceRangeComplete) {
            List<FederatedResearchRecord> page = catalog.findAfterId(cursor, scanPageSize);
            if (page.isEmpty()) {
                break;
            }

            int sourceRecordsOnPage = 0;
            for (FederatedResearchRecord record : page) {
                if (record.sourceSystem() != run.sourceSystem()) {
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
            }

            if (sourceRangeComplete || page.size() < scanPageSize || sourceRecordsOnPage == 0) {
                break;
            }
        }

        return new FederatedCorpusManifest(
                MANIFEST_VERSION,
                run.id(),
                run.sourceSystem(),
                run.adapterVersion(),
                List.copyOf(adapterVersions),
                retainedRecordCount,
                run.acceptedCount(),
                run.rejectedCount(),
                run.skippedCount(),
                firstRecordId,
                lastRecordId,
                HexFormat.of().formatHex(digest.digest()),
                earliestSourceUpdatedAt,
                latestSourceUpdatedAt,
                run.pageSize(),
                run.pageCount(),
                run.cursor(),
                run.startedAt(),
                run.completedAt());
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
}
