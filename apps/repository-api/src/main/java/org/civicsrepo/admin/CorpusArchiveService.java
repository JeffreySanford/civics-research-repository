package org.civicsrepo.admin;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import jakarta.transaction.Transactional;
import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.nio.file.AtomicMoveNotSupportedException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.security.DigestInputStream;
import java.security.DigestOutputStream;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.EnumMap;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.zip.GZIPInputStream;
import java.util.zip.GZIPOutputStream;
import org.civicsrepo.federation.CorpusProfile;
import org.civicsrepo.federation.FederatedCompositeCorpusManifest;
import org.civicsrepo.federation.FederatedCompositeCorpusManifestStore;
import org.civicsrepo.federation.FederatedCompositeCorpusProjectionService;
import org.civicsrepo.federation.FederatedCompositeCorpusSource;
import org.civicsrepo.federation.FederatedMetadataCatalog;
import org.civicsrepo.federation.FederatedResearchRecord;
import org.civicsrepo.federation.FederatedSourceSystem;
import org.civicsrepo.federation.HarvestCheckpointStore;
import org.civicsrepo.federation.HarvestRun;
import org.civicsrepo.federation.HarvestRunStatus;
import org.civicsrepo.federation.HarvestRunStore;
import org.civicsrepo.repository.DiscoveryProjectionService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/**
 * Creates, verifies, probes and restores portable archives of retained federated metadata.
 *
 * <p>Archives intentionally exclude DSpace, Solr and OpenSearch. DSpace remains its own repository
 * authority and the search engines remain rebuildable projections. The archive is a streamed,
 * compressed JSONL copy of the exact federated profile slice plus immutable evidence metadata.
 */
@Service
public class CorpusArchiveService {
    static final String ARCHIVE_VERSION = "civics-corpus-archive/v1";
    static final int PAGE_SIZE = 1_000;
    static final int RESTORE_BATCH_SIZE = 1_000;
    private static final String RECORDS_FILE = "federated-records.jsonl.gz";
    private static final String MANIFEST_FILE = "manifest.json";
    private static final String STATUS_FILE = "status.json";
    private static final String DATA_GOV_DEFAULT_URL = "https://api.gsa.gov/technology/datagov/v4/search";
    private static final String OSTI_DEFAULT_URL = "https://www.osti.gov/api/v1/records";

    private final Path archiveRoot;
    private final FederatedMetadataCatalog catalog;
    private final FederatedCompositeCorpusManifestStore compositeManifestStore;
    private final FederatedCompositeCorpusProjectionService compositeProjectionService;
    private final HarvestCheckpointStore checkpointStore;
    private final HarvestRunStore runStore;
    private final CorpusProfileActivationService activationService;
    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;
    private final Clock clock;
    private final String dataGovSearchUrl;
    private final String dataGovApiKey;
    private final String ostiRecordsUrl;

    public CorpusArchiveService(
            FederatedMetadataCatalog catalog,
            FederatedCompositeCorpusManifestStore compositeManifestStore,
            FederatedCompositeCorpusProjectionService compositeProjectionService,
            HarvestCheckpointStore checkpointStore,
            HarvestRunStore runStore,
            CorpusProfileActivationService activationService,
            ObjectMapper objectMapper,
            @Value("${civics.storage.corpus-archives-path:/var/lib/civics/corpus-archives}") String archivePath,
            @Value("${civics.federation.data-gov.search-url:" + DATA_GOV_DEFAULT_URL + "}") String dataGovSearchUrl,
            @Value("${civics.federation.data-gov.api-key:DEMO_KEY}") String dataGovApiKey,
            @Value("${civics.federation.osti.records-url:" + OSTI_DEFAULT_URL + "}") String ostiRecordsUrl) {
        this(
                catalog,
                compositeManifestStore,
                compositeProjectionService,
                checkpointStore,
                runStore,
                activationService,
                objectMapper,
                Path.of(archivePath),
                HttpClient.newBuilder().build(),
                Clock.systemUTC(),
                dataGovSearchUrl,
                dataGovApiKey,
                ostiRecordsUrl);
    }

    CorpusArchiveService(
            FederatedMetadataCatalog catalog,
            FederatedCompositeCorpusManifestStore compositeManifestStore,
            FederatedCompositeCorpusProjectionService compositeProjectionService,
            HarvestCheckpointStore checkpointStore,
            HarvestRunStore runStore,
            CorpusProfileActivationService activationService,
            ObjectMapper objectMapper,
            Path archiveRoot,
            HttpClient httpClient,
            Clock clock,
            String dataGovSearchUrl,
            String dataGovApiKey,
            String ostiRecordsUrl) {
        this.catalog = Objects.requireNonNull(catalog, "catalog");
        this.compositeManifestStore = Objects.requireNonNull(compositeManifestStore, "compositeManifestStore");
        this.compositeProjectionService = Objects.requireNonNull(compositeProjectionService, "compositeProjectionService");
        this.checkpointStore = Objects.requireNonNull(checkpointStore, "checkpointStore");
        this.runStore = Objects.requireNonNull(runStore, "runStore");
        this.activationService = Objects.requireNonNull(activationService, "activationService");
        this.objectMapper = Objects.requireNonNull(objectMapper, "objectMapper")
                .copy()
                .enable(SerializationFeature.ORDER_MAP_ENTRIES_BY_KEYS);
        this.archiveRoot = Objects.requireNonNull(archiveRoot, "archiveRoot").toAbsolutePath().normalize();
        this.httpClient = Objects.requireNonNull(httpClient, "httpClient");
        this.clock = Objects.requireNonNull(clock, "clock");
        this.dataGovSearchUrl = stripTrailingQuestionMark(requireText(dataGovSearchUrl, "dataGovSearchUrl"));
        this.dataGovApiKey = requireText(dataGovApiKey, "dataGovApiKey");
        this.ostiRecordsUrl = stripTrailingQuestionMark(requireText(ostiRecordsUrl, "ostiRecordsUrl"));
    }

    public synchronized List<CorpusArchiveSummary> list() {
        ensureRoot();
        try (var paths = Files.list(archiveRoot)) {
            return paths.filter(Files::isDirectory)
                    .map(path -> readSummary(path.getFileName().toString()))
                    .sorted(Comparator.comparing(CorpusArchiveSummary::createdAt).reversed())
                    .toList();
        } catch (IOException exception) {
            throw storageFailure("Corpus archives could not be listed", exception);
        }
    }

    public synchronized CorpusArchiveSummary create(CorpusProfile profile, String requestedLabel) {
        Objects.requireNonNull(profile, "profile");
        if (profile == CorpusProfile.CURATED_DEMO) {
            throw new IllegalArgumentException("CURATED_DEMO contains no federated corpus to archive");
        }

        ArchiveRecipe recipe = recipe(profile);
        assertNoRunningHarvest(recipe.sourceCounts().keySet());
        for (Map.Entry<FederatedSourceSystem, Long> source : recipe.sourceCounts().entrySet()) {
            long retained = catalog.count(source.getKey());
            if (retained < source.getValue()) {
                throw new IllegalStateException(source.getKey().name()
                        + " retains "
                        + retained
                        + " records; archive requires "
                        + source.getValue());
            }
        }

        ensureRoot();
        OffsetDateTime createdAt = now();
        String archiveId = archiveId(profile, createdAt);
        String label = normalizeLabel(requestedLabel, profile, createdAt);
        Path directory = archiveDirectory(archiveId);
        Path records = directory.resolve(RECORDS_FILE);
        Path temporaryRecords = directory.resolve(RECORDS_FILE + ".tmp");

        try {
            Files.createDirectory(directory);
            ArchiveWriteResult writeResult = writeArchiveRecords(temporaryRecords, recipe.sourceCounts());
            moveAtomically(temporaryRecords, records);

            Map<FederatedSourceSystem, FreshnessMarker> freshnessMarkers = new EnumMap<>(FederatedSourceSystem.class);
            for (FederatedSourceSystem source : recipe.sourceCounts().keySet()) {
                SourceProbe probe = probe(source);
                if (probe.status() == FreshnessStatus.NO_NEWER_MARKER && probe.marker() != null) {
                    freshnessMarkers.put(source, probe.marker());
                }
            }

            Map<FederatedSourceSystem, HarvestRun> sourceRuns = archiveSourceRuns(recipe);
            ArchiveManifest manifest = new ArchiveManifest(
                    ARCHIVE_VERSION,
                    archiveId,
                    label,
                    profile,
                    createdAt,
                    writeResult.recordCount(),
                    Map.copyOf(recipe.sourceCounts()),
                    Files.size(records),
                    writeResult.archiveSha256(),
                    writeResult.logicalSha256(),
                    recipe.composition() == null ? null : recipe.composition().compositionSha256(),
                    recipe.composition(),
                    Map.copyOf(sourceRuns),
                    Map.copyOf(freshnessMarkers));
            writeJson(directory.resolve(MANIFEST_FILE), manifest);
            writeState(directory, ArchiveState.initial());
            return summary(manifest, ArchiveState.initial());
        } catch (RuntimeException | IOException exception) {
            deleteDirectoryQuietly(directory);
            if (exception instanceof RuntimeException runtimeException) {
                throw runtimeException;
            }
            throw storageFailure("Corpus archive could not be created", exception);
        }
    }

    public synchronized CorpusArchiveSummary verify(String archiveId) {
        ArchiveManifest manifest = readManifest(archiveId);
        Path records = archiveDirectory(archiveId).resolve(RECORDS_FILE);
        if (!Files.isRegularFile(records)) {
            ArchiveState failed = readState(archiveId).withIntegrity(
                    IntegrityStatus.FAILED, now(), "Archive payload is missing.");
            writeState(archiveDirectory(archiveId), failed);
            return summary(manifest, failed);
        }

        try {
            String physicalSha = sha256(records);
            LogicalVerification logical = logicalVerification(records);
            boolean valid = physicalSha.equals(manifest.archiveSha256())
                    && logical.sha256().equals(manifest.logicalSha256())
                    && logical.recordCount() == manifest.recordCount();
            String detail = valid
                    ? "Physical and logical SHA-256 checks match the immutable archive manifest."
                    : "Archive checksum, logical checksum, or record count does not match the immutable manifest.";
            ArchiveState state = readState(archiveId).withIntegrity(
                    valid ? IntegrityStatus.VERIFIED : IntegrityStatus.FAILED, now(), detail);
            writeState(archiveDirectory(archiveId), state);
            return summary(manifest, state);
        } catch (IOException exception) {
            throw storageFailure("Corpus archive could not be verified", exception);
        }
    }

    public synchronized CorpusArchiveSummary checkFreshness(String archiveId) {
        ArchiveManifest manifest = readManifest(archiveId);
        Map<FederatedSourceSystem, SourceFreshness> perSource = new EnumMap<>(FederatedSourceSystem.class);
        boolean anyUpdate = false;
        boolean anyUnknown = false;

        for (FederatedSourceSystem source : manifest.sourceCounts().keySet()) {
            FreshnessMarker archivedMarker = manifest.sourceFreshnessMarkers().get(source);
            if (archivedMarker == null) {
                perSource.put(source, new SourceFreshness(
                        source,
                        FreshnessStatus.UNKNOWN,
                        null,
                        "No publisher head marker was available when this archive was created."));
                anyUnknown = true;
                continue;
            }

            SourceProbe probe = probe(source);
            SourceFreshness result = compareFreshness(source, archivedMarker, probe);
            perSource.put(source, result);
            anyUpdate |= result.status() == FreshnessStatus.UPDATE_AVAILABLE;
            anyUnknown |= result.status() == FreshnessStatus.UNKNOWN;
        }

        FreshnessStatus aggregate = anyUpdate
                ? FreshnessStatus.UPDATE_AVAILABLE
                : anyUnknown ? FreshnessStatus.UNKNOWN : FreshnessStatus.NO_NEWER_MARKER;
        String detail = switch (aggregate) {
            case UPDATE_AVAILABLE -> "At least one publisher exposes a newer source marker than this archive baseline.";
            case UNKNOWN -> "At least one publisher freshness probe could not be evaluated.";
            case NO_NEWER_MARKER -> "No newer publisher source marker was detected by the lightweight head probes.";
            case NOT_CHECKED -> "Freshness has not been checked.";
        };

        ArchiveState state = readState(archiveId).withFreshness(aggregate, now(), detail, Map.copyOf(perSource));
        writeState(archiveDirectory(archiveId), state);
        return summary(manifest, state);
    }

    @Transactional
    public synchronized CorpusArchiveRestoreResult restore(
            String archiveId, boolean replaceExisting, CorpusProfile activateProfileAfterRestore) {
        if (!replaceExisting) {
            throw new IllegalArgumentException("Archive restore requires replaceExisting=true");
        }
        CorpusArchiveSummary verified = verify(archiveId);
        if (verified.integrityStatus() != IntegrityStatus.VERIFIED) {
            throw new IllegalStateException("Archive restore is blocked because checksum verification failed");
        }

        ArchiveManifest manifest = readManifest(archiveId);
        assertNoRunningHarvest(List.of(FederatedSourceSystem.values()));
        OffsetDateTime restoredAt = now();

        for (FederatedSourceSystem source : FederatedSourceSystem.values()) {
            checkpointStore.clear(source);
            runStore.cancelResumable(source, restoredAt);
        }

        catalog.deleteAll();
        restoreRecords(archiveDirectory(archiveId).resolve(RECORDS_FILE));
        assertRestoredCounts(manifest);
        restoreCompositionEvidence(manifest, restoredAt);

        CorpusProfile activatedProfile = activateProfileAfterRestore == null ? manifest.profile() : activateProfileAfterRestore;
        String projectionId = null;
        if (activatedProfile == CorpusProfile.FEDERATED_1M) {
            if (manifest.composition() == null || manifest.compositionSha256() == null) {
                throw new IllegalStateException("FEDERATED_1M restore requires archived composite-corpus evidence");
            }
            compositeProjectionService.project(manifest.compositionSha256());
            projectionId = activationService.currentActivation().map(activation -> activation.projectionId()).orElse(null);
        } else {
            DiscoveryProjectionService.ProjectionState projected = activationService.activate(activatedProfile);
            projectionId = activationService.currentActivation()
                    .map(activation -> activation.projectionId())
                    .orElse(null);
            if (projected.objectCount() < 0) {
                throw new IllegalStateException("Restored projection returned an invalid object count");
            }
        }

        return new CorpusArchiveRestoreResult(
                readSummary(archiveId), manifest.recordCount(), manifest.sourceCounts(), activatedProfile, projectionId);
    }

    public synchronized void delete(String archiveId) {
        Path directory = archiveDirectory(archiveId);
        if (!Files.isDirectory(directory)) {
            throw new ArchiveNotFoundException(archiveId);
        }
        try {
            deleteDirectory(directory);
        } catch (IOException exception) {
            throw storageFailure("Corpus archive could not be deleted", exception);
        }
    }

    private ArchiveRecipe recipe(CorpusProfile profile) {
        if (profile == CorpusProfile.FEDERATED_1M) {
            FederatedCompositeCorpusManifest composition = compositeManifestStore.findRecent(profile, 100).stream()
                    .filter(this::isExactC2)
                    .findFirst()
                    .orElseThrow(() -> new IllegalStateException(
                            "No exact FEDERATED_1M composition exists for 500,000 DATA_GOV + 500,000 DOE_OSTI"));
            Map<FederatedSourceSystem, Long> counts = new EnumMap<>(FederatedSourceSystem.class);
            for (FederatedCompositeCorpusSource source : composition.sources()) {
                counts.put(source.sourceSystem(), source.requestedRecordCount());
            }
            return new ArchiveRecipe(Map.copyOf(counts), composition);
        }

        if (profile == CorpusProfile.FEDERATED_10K || profile == CorpusProfile.FEDERATED_100K) {
            long target = profile.targetRecordCount().orElseThrow();
            return new ArchiveRecipe(Map.of(FederatedSourceSystem.DATA_GOV, target), null);
        }

        if (profile == CorpusProfile.FULL) {
            Map<FederatedSourceSystem, Long> counts = new EnumMap<>(FederatedSourceSystem.class);
            for (FederatedSourceSystem source : FederatedSourceSystem.values()) {
                long retained = catalog.count(source);
                if (retained > 0) {
                    counts.put(source, retained);
                }
            }
            if (counts.isEmpty()) {
                throw new IllegalStateException("No retained federated metadata is available to archive");
            }
            return new ArchiveRecipe(Map.copyOf(counts), null);
        }

        throw new IllegalArgumentException("Unsupported archive profile " + profile);
    }

    private boolean isExactC2(FederatedCompositeCorpusManifest manifest) {
        if (manifest.federatedRecordCount() != 1_000_000 || manifest.sources().size() != 2) {
            return false;
        }
        Map<FederatedSourceSystem, Long> counts = new EnumMap<>(FederatedSourceSystem.class);
        for (FederatedCompositeCorpusSource source : manifest.sources()) {
            counts.put(source.sourceSystem(), source.requestedRecordCount());
        }
        return counts.getOrDefault(FederatedSourceSystem.DATA_GOV, 0L) == 500_000L
                && counts.getOrDefault(FederatedSourceSystem.DOE_OSTI, 0L) == 500_000L;
    }

    private ArchiveWriteResult writeArchiveRecords(
            Path destination, Map<FederatedSourceSystem, Long> sourceCounts) throws IOException {
        MessageDigest physicalDigest = sha256Digest();
        MessageDigest logicalDigest = sha256Digest();
        long written = 0;

        try (OutputStream fileOut = Files.newOutputStream(destination);
                DigestOutputStream digestOut = new DigestOutputStream(fileOut, physicalDigest);
                GZIPOutputStream gzipOut = new GZIPOutputStream(digestOut)) {
            for (Map.Entry<FederatedSourceSystem, Long> source : sourceCounts.entrySet().stream()
                    .sorted(Map.Entry.comparingByKey(Comparator.comparing(Enum::name)))
                    .toList()) {
                String cursor = source.getKey().name() + ":";
                long remaining = source.getValue();
                while (remaining > 0) {
                    int limit = (int) Math.min(PAGE_SIZE, remaining);
                    List<FederatedResearchRecord> page = catalog.findSourceAfterId(source.getKey(), cursor, limit);
                    if (page.isEmpty()) {
                        throw new IllegalStateException(source.getKey().name()
                                + " ended before the requested archive quota; missing "
                                + remaining
                                + " records");
                    }
                    for (FederatedResearchRecord record : page) {
                        byte[] json = objectMapper.writeValueAsBytes(record);
                        logicalDigest.update(json);
                        logicalDigest.update((byte) '\n');
                        gzipOut.write(json);
                        gzipOut.write('\n');
                        cursor = record.id();
                        written++;
                        remaining--;
                    }
                }
            }
        }

        return new ArchiveWriteResult(
                written,
                HexFormat.of().formatHex(physicalDigest.digest()),
                HexFormat.of().formatHex(logicalDigest.digest()));
    }

    private void restoreRecords(Path records) {
        List<FederatedResearchRecord> batch = new ArrayList<>(RESTORE_BATCH_SIZE);
        try (InputStream input = Files.newInputStream(records);
                GZIPInputStream gzip = new GZIPInputStream(input);
                BufferedReader reader = new BufferedReader(new java.io.InputStreamReader(gzip, StandardCharsets.UTF_8))) {
            String line;
            while ((line = reader.readLine()) != null) {
                if (line.isBlank()) {
                    continue;
                }
                batch.add(objectMapper.readValue(line, FederatedResearchRecord.class));
                if (batch.size() >= RESTORE_BATCH_SIZE) {
                    catalog.upsertBatch(List.copyOf(batch));
                    batch.clear();
                }
            }
            if (!batch.isEmpty()) {
                catalog.upsertBatch(List.copyOf(batch));
            }
        } catch (IOException exception) {
            throw storageFailure("Corpus archive payload could not be restored", exception);
        }
    }

    private void restoreCompositionEvidence(ArchiveManifest manifest, OffsetDateTime restoredAt) {
        if (manifest.composition() == null) {
            return;
        }
        for (FederatedCompositeCorpusSource source : manifest.composition().sources()) {
            HarvestRun original = manifest.sourceRuns().get(source.sourceSystem());
            HarvestRun restoredRun = original == null
                    ? syntheticCompletedRun(source, restoredAt)
                    : new HarvestRun(
                            original.id(),
                            original.sourceSystem(),
                            original.adapterVersion(),
                            HarvestRunStatus.COMPLETED,
                            original.pageSize(),
                            original.pageCount(),
                            original.acceptedCount(),
                            original.rejectedCount(),
                            original.skippedCount(),
                            null,
                            original.startedAt(),
                            restoredAt,
                            restoredAt,
                            null);
            runStore.save(restoredRun);
        }
        compositeManifestStore.save(manifest.composition());
    }

    private HarvestRun syntheticCompletedRun(FederatedCompositeCorpusSource source, OffsetDateTime restoredAt) {
        return new HarvestRun(
                source.runId(),
                source.sourceSystem(),
                source.runAdapterVersion(),
                HarvestRunStatus.COMPLETED,
                1,
                0,
                source.requestedRecordCount(),
                0,
                0,
                null,
                source.snapshotCapturedAt(),
                restoredAt,
                restoredAt,
                null);
    }

    private Map<FederatedSourceSystem, HarvestRun> archiveSourceRuns(ArchiveRecipe recipe) {
        Map<FederatedSourceSystem, HarvestRun> runs = new EnumMap<>(FederatedSourceSystem.class);
        if (recipe.composition() != null) {
            for (FederatedCompositeCorpusSource source : recipe.composition().sources()) {
                runStore.findById(source.runId()).ifPresent(run -> runs.put(source.sourceSystem(), run));
            }
            return runs;
        }
        for (FederatedSourceSystem source : recipe.sourceCounts().keySet()) {
            List<HarvestRun> recent = runStore.findRecent(source, 1);
            if (!recent.isEmpty()) {
                runs.put(source, recent.getFirst());
            }
        }
        return runs;
    }

    private void assertRestoredCounts(ArchiveManifest manifest) {
        if (catalog.count() != manifest.recordCount()) {
            throw new IllegalStateException("Restored federated record count does not match archive manifest");
        }
        for (Map.Entry<FederatedSourceSystem, Long> source : manifest.sourceCounts().entrySet()) {
            long restored = catalog.count(source.getKey());
            if (restored != source.getValue()) {
                throw new IllegalStateException("Restored "
                        + source.getKey().name()
                        + " count "
                        + restored
                        + " does not match archived count "
                        + source.getValue());
            }
        }
    }

    private void assertNoRunningHarvest(Iterable<FederatedSourceSystem> sources) {
        for (FederatedSourceSystem source : sources) {
            runStore.findResumable(source)
                    .filter(run -> run.status() == HarvestRunStatus.RUNNING)
                    .ifPresent(run -> {
                        throw new IllegalStateException("Corpus archive operation is blocked while "
                                + source.name()
                                + " harvest run "
                                + run.id()
                                + " is RUNNING");
                    });
        }
    }

    private SourceFreshness compareFreshness(
            FederatedSourceSystem source, FreshnessMarker archived, SourceProbe probe) {
        if (probe.status() == FreshnessStatus.UNKNOWN || probe.marker() == null) {
            return new SourceFreshness(source, FreshnessStatus.UNKNOWN, probe.marker(), probe.detail());
        }
        OffsetDateTime archivedTimestamp = parseFlexibleTimestamp(archived.markerTimestamp());
        OffsetDateTime currentTimestamp = parseFlexibleTimestamp(probe.marker().markerTimestamp());
        if (archivedTimestamp == null || currentTimestamp == null) {
            return new SourceFreshness(
                    source,
                    FreshnessStatus.UNKNOWN,
                    probe.marker(),
                    "Publisher marker timestamp could not be compared safely.");
        }
        if (currentTimestamp.isAfter(archivedTimestamp)) {
            return new SourceFreshness(
                    source,
                    FreshnessStatus.UPDATE_AVAILABLE,
                    probe.marker(),
                    "Publisher exposes a newer source marker than the archive baseline.");
        }
        if (currentTimestamp.isEqual(archivedTimestamp)
                && !Objects.equals(archived.markerId(), probe.marker().markerId())) {
            return new SourceFreshness(
                    source,
                    FreshnessStatus.UNKNOWN,
                    probe.marker(),
                    "Newest timestamp matches the archive baseline but the publisher head identifier differs.");
        }
        return new SourceFreshness(
                source,
                FreshnessStatus.NO_NEWER_MARKER,
                probe.marker(),
                "No newer publisher source marker detected.");
    }

    private SourceProbe probe(FederatedSourceSystem source) {
        try {
            return switch (source) {
                case DATA_GOV -> probeDataGov();
                case DOE_OSTI -> probeOsti();
                default -> new SourceProbe(
                        FreshnessStatus.UNKNOWN, null, "No lightweight freshness probe is configured for " + source.name());
            };
        } catch (RuntimeException exception) {
            return new SourceProbe(FreshnessStatus.UNKNOWN, null, exception.getMessage());
        }
    }

    private SourceProbe probeDataGov() {
        URI uri = URI.create(dataGovSearchUrl
                + (dataGovSearchUrl.contains("?") ? "&" : "?")
                + "per_page=1&sort=last_harvested_date");
        HttpRequest request = HttpRequest.newBuilder(uri)
                .header("Accept", "application/json")
                .header("X-Api-Key", dataGovApiKey)
                .GET()
                .build();
        HttpResponse<String> response = send(request, "Data.gov");
        if (response.statusCode() == 429) {
            return new SourceProbe(FreshnessStatus.UNKNOWN, null, "Data.gov rate limited the freshness probe (HTTP 429).");
        }
        if (response.statusCode() >= 300) {
            return new SourceProbe(
                    FreshnessStatus.UNKNOWN, null, "Data.gov freshness probe returned HTTP " + response.statusCode() + ".");
        }
        try {
            JsonNode first = objectMapper.readTree(response.body()).path("results").path(0);
            String timestamp = text(first, "last_harvested_date");
            String id = text(first, "identifier");
            if (timestamp == null) {
                return new SourceProbe(FreshnessStatus.UNKNOWN, null, "Data.gov returned no last_harvested_date marker.");
            }
            return new SourceProbe(
                    FreshnessStatus.NO_NEWER_MARKER,
                    new FreshnessMarker(now(), timestamp, id),
                    "Data.gov publisher head marker captured.");
        } catch (IOException exception) {
            return new SourceProbe(FreshnessStatus.UNKNOWN, null, "Data.gov freshness response could not be parsed.");
        }
    }

    private SourceProbe probeOsti() {
        URI uri = URI.create(ostiRecordsUrl
                + (ostiRecordsUrl.contains("?") ? "&" : "?")
                + "rows=1&page=1&sort=entry_date&order=desc");
        HttpRequest request = HttpRequest.newBuilder(uri).header("Accept", "application/json").GET().build();
        HttpResponse<String> response = send(request, "OSTI.GOV");
        if (response.statusCode() == 429) {
            return new SourceProbe(FreshnessStatus.UNKNOWN, null, "OSTI.GOV rate limited the freshness probe (HTTP 429).");
        }
        if (response.statusCode() >= 300) {
            return new SourceProbe(
                    FreshnessStatus.UNKNOWN, null, "OSTI.GOV freshness probe returned HTTP " + response.statusCode() + ".");
        }
        try {
            JsonNode first = objectMapper.readTree(response.body()).path(0);
            String timestamp = text(first, "entry_date");
            String id = text(first, "osti_id");
            if (timestamp == null) {
                return new SourceProbe(FreshnessStatus.UNKNOWN, null, "OSTI.GOV returned no entry_date marker.");
            }
            return new SourceProbe(
                    FreshnessStatus.NO_NEWER_MARKER,
                    new FreshnessMarker(now(), timestamp, id),
                    "OSTI.GOV publisher head marker captured.");
        } catch (IOException exception) {
            return new SourceProbe(FreshnessStatus.UNKNOWN, null, "OSTI.GOV freshness response could not be parsed.");
        }
    }

    private HttpResponse<String> send(HttpRequest request, String sourceLabel) {
        try {
            return httpClient.send(request, HttpResponse.BodyHandlers.ofString());
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException(sourceLabel + " freshness probe was interrupted.", exception);
        } catch (IOException exception) {
            throw new IllegalStateException(sourceLabel + " freshness probe failed.", exception);
        }
    }

    private LogicalVerification logicalVerification(Path records) throws IOException {
        MessageDigest digest = sha256Digest();
        long lineCount = 0;
        try (InputStream input = Files.newInputStream(records);
                GZIPInputStream gzip = new GZIPInputStream(input);
                DigestInputStream digestInput = new DigestInputStream(gzip, digest)) {
            byte[] buffer = new byte[64 * 1024];
            int read;
            while ((read = digestInput.read(buffer)) >= 0) {
                for (int index = 0; index < read; index++) {
                    if (buffer[index] == '\n') {
                        lineCount++;
                    }
                }
            }
        }
        return new LogicalVerification(HexFormat.of().formatHex(digest.digest()), lineCount);
    }

    private String sha256(Path file) throws IOException {
        MessageDigest digest = sha256Digest();
        try (InputStream input = Files.newInputStream(file); DigestInputStream digestInput = new DigestInputStream(input, digest)) {
            byte[] buffer = new byte[64 * 1024];
            while (digestInput.read(buffer) >= 0) {
                // DigestInputStream updates the digest as bytes are consumed.
            }
        }
        return HexFormat.of().formatHex(digest.digest());
    }

    private MessageDigest sha256Digest() {
        try {
            return MessageDigest.getInstance("SHA-256");
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is unavailable", exception);
        }
    }

    private CorpusArchiveSummary readSummary(String archiveId) {
        return summary(readManifest(archiveId), readState(archiveId));
    }

    private CorpusArchiveSummary summary(ArchiveManifest manifest, ArchiveState state) {
        return new CorpusArchiveSummary(
                manifest.archiveId(),
                manifest.label(),
                manifest.profile(),
                manifest.createdAt(),
                manifest.recordCount(),
                manifest.sourceCounts(),
                manifest.compressedBytes(),
                manifest.archiveSha256(),
                manifest.logicalSha256(),
                manifest.compositionSha256(),
                state.integrityStatus(),
                state.integrityCheckedAt(),
                state.integrityDetail(),
                state.freshnessStatus(),
                state.freshnessCheckedAt(),
                state.freshnessDetail(),
                state.sourceFreshness());
    }

    private ArchiveManifest readManifest(String archiveId) {
        Path path = archiveDirectory(archiveId).resolve(MANIFEST_FILE);
        if (!Files.isRegularFile(path)) {
            throw new ArchiveNotFoundException(archiveId);
        }
        try {
            ArchiveManifest manifest = objectMapper.readValue(path.toFile(), ArchiveManifest.class);
            if (!ARCHIVE_VERSION.equals(manifest.archiveVersion())) {
                throw new IllegalStateException("Unsupported corpus archive version " + manifest.archiveVersion());
            }
            return manifest;
        } catch (IOException exception) {
            throw storageFailure("Corpus archive manifest could not be read", exception);
        }
    }

    private ArchiveState readState(String archiveId) {
        Path path = archiveDirectory(archiveId).resolve(STATUS_FILE);
        if (!Files.isRegularFile(path)) {
            return ArchiveState.initial();
        }
        try {
            return objectMapper.readValue(path.toFile(), ArchiveState.class);
        } catch (IOException exception) {
            throw storageFailure("Corpus archive status could not be read", exception);
        }
    }

    private void writeState(Path directory, ArchiveState state) {
        writeJson(directory.resolve(STATUS_FILE), state);
    }

    private void writeJson(Path destination, Object value) {
        Path temporary = destination.resolveSibling(destination.getFileName() + ".tmp");
        try {
            objectMapper.writerWithDefaultPrettyPrinter().writeValue(temporary.toFile(), value);
            moveAtomically(temporary, destination);
        } catch (IOException exception) {
            throw storageFailure("Corpus archive metadata could not be written", exception);
        }
    }

    private void moveAtomically(Path source, Path destination) throws IOException {
        try {
            Files.move(source, destination, StandardCopyOption.ATOMIC_MOVE, StandardCopyOption.REPLACE_EXISTING);
        } catch (AtomicMoveNotSupportedException ignored) {
            Files.move(source, destination, StandardCopyOption.REPLACE_EXISTING);
        }
    }

    private void ensureRoot() {
        try {
            Files.createDirectories(archiveRoot);
        } catch (IOException exception) {
            throw storageFailure("Corpus archive directory could not be created", exception);
        }
    }

    private Path archiveDirectory(String archiveId) {
        String safeId = requireArchiveId(archiveId);
        Path resolved = archiveRoot.resolve(safeId).normalize();
        if (!resolved.startsWith(archiveRoot)) {
            throw new IllegalArgumentException("Invalid corpus archive ID");
        }
        return resolved;
    }

    private String requireArchiveId(String archiveId) {
        String normalized = requireText(archiveId, "archiveId");
        if (!normalized.matches("[a-z0-9-]{8,120}")) {
            throw new IllegalArgumentException("Invalid corpus archive ID");
        }
        return normalized;
    }

    private String archiveId(CorpusProfile profile, OffsetDateTime createdAt) {
        return profile.name().toLowerCase().replace('_', '-')
                + "-"
                + createdAt.toInstant().toEpochMilli()
                + "-"
                + UUID.randomUUID().toString().substring(0, 8);
    }

    private String normalizeLabel(String value, CorpusProfile profile, OffsetDateTime createdAt) {
        String label = value == null || value.isBlank()
                ? profile.name() + " archive " + createdAt.toInstant()
                : value.trim();
        if (label.length() > 160) {
            throw new IllegalArgumentException("Archive label must be 160 characters or fewer");
        }
        return label;
    }

    private OffsetDateTime parseFlexibleTimestamp(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            return OffsetDateTime.parse(value);
        } catch (DateTimeParseException ignored) {
            try {
                return LocalDateTime.parse(value).atOffset(ZoneOffset.UTC);
            } catch (DateTimeParseException ignoredLocal) {
                try {
                    return LocalDate.parse(value).atStartOfDay().atOffset(ZoneOffset.UTC);
                } catch (DateTimeParseException ignoredDate) {
                    return null;
                }
            }
        }
    }

    private String text(JsonNode node, String field) {
        if (node == null || node.isMissingNode() || node.isNull()) {
            return null;
        }
        JsonNode value = node.path(field);
        if (value.isMissingNode() || value.isNull()) {
            return null;
        }
        String text = value.asText("").trim();
        return text.isBlank() ? null : text;
    }

    private OffsetDateTime now() {
        return OffsetDateTime.ofInstant(clock.instant(), ZoneOffset.UTC);
    }

    private String stripTrailingQuestionMark(String value) {
        String result = value.trim();
        while (result.endsWith("?")) {
            result = result.substring(0, result.length() - 1);
        }
        return result;
    }

    private String requireText(String value, String field) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException(field + " must not be blank");
        }
        return value.trim();
    }

    private IllegalStateException storageFailure(String message, Exception cause) {
        return new IllegalStateException(message, cause);
    }

    private void deleteDirectoryQuietly(Path directory) {
        try {
            if (Files.exists(directory)) {
                deleteDirectory(directory);
            }
        } catch (IOException ignored) {
            // Best-effort cleanup after a failed archive creation; original failure is more useful.
        }
    }

    private void deleteDirectory(Path directory) throws IOException {
        try (var paths = Files.walk(directory)) {
            for (Path path : paths.sorted(Comparator.reverseOrder()).toList()) {
                Files.deleteIfExists(path);
            }
        }
    }

    public enum IntegrityStatus {
        NOT_CHECKED,
        VERIFIED,
        FAILED
    }

    public enum FreshnessStatus {
        NOT_CHECKED,
        NO_NEWER_MARKER,
        UPDATE_AVAILABLE,
        UNKNOWN
    }

    public record FreshnessMarker(OffsetDateTime observedAt, String markerTimestamp, String markerId) {}

    public record SourceFreshness(
            FederatedSourceSystem sourceSystem,
            FreshnessStatus status,
            FreshnessMarker currentMarker,
            String detail) {}

    public record CorpusArchiveSummary(
            String archiveId,
            String label,
            CorpusProfile profile,
            OffsetDateTime createdAt,
            long recordCount,
            Map<FederatedSourceSystem, Long> sourceCounts,
            long compressedBytes,
            String archiveSha256,
            String logicalSha256,
            String compositionSha256,
            IntegrityStatus integrityStatus,
            OffsetDateTime integrityCheckedAt,
            String integrityDetail,
            FreshnessStatus freshnessStatus,
            OffsetDateTime freshnessCheckedAt,
            String freshnessDetail,
            Map<FederatedSourceSystem, SourceFreshness> sourceFreshness) {}

    public record CorpusArchiveRestoreResult(
            CorpusArchiveSummary archive,
            long restoredRecordCount,
            Map<FederatedSourceSystem, Long> restoredSourceCounts,
            CorpusProfile activatedProfile,
            String projectionId) {}

    public record ArchiveManifest(
            String archiveVersion,
            String archiveId,
            String label,
            CorpusProfile profile,
            OffsetDateTime createdAt,
            long recordCount,
            Map<FederatedSourceSystem, Long> sourceCounts,
            long compressedBytes,
            String archiveSha256,
            String logicalSha256,
            String compositionSha256,
            FederatedCompositeCorpusManifest composition,
            Map<FederatedSourceSystem, HarvestRun> sourceRuns,
            Map<FederatedSourceSystem, FreshnessMarker> sourceFreshnessMarkers) {}

    public record ArchiveState(
            IntegrityStatus integrityStatus,
            OffsetDateTime integrityCheckedAt,
            String integrityDetail,
            FreshnessStatus freshnessStatus,
            OffsetDateTime freshnessCheckedAt,
            String freshnessDetail,
            Map<FederatedSourceSystem, SourceFreshness> sourceFreshness) {
        static ArchiveState initial() {
            return new ArchiveState(
                    IntegrityStatus.NOT_CHECKED,
                    null,
                    "Checksum has not been verified since archive creation.",
                    FreshnessStatus.NOT_CHECKED,
                    null,
                    "Freshness has not been checked.",
                    Map.of());
        }

        ArchiveState withIntegrity(IntegrityStatus status, OffsetDateTime checkedAt, String detail) {
            return new ArchiveState(
                    status,
                    checkedAt,
                    detail,
                    freshnessStatus,
                    freshnessCheckedAt,
                    freshnessDetail,
                    sourceFreshness);
        }

        ArchiveState withFreshness(
                FreshnessStatus status,
                OffsetDateTime checkedAt,
                String detail,
                Map<FederatedSourceSystem, SourceFreshness> perSource) {
            return new ArchiveState(
                    integrityStatus,
                    integrityCheckedAt,
                    integrityDetail,
                    status,
                    checkedAt,
                    detail,
                    perSource);
        }
    }

    public static final class ArchiveNotFoundException extends RuntimeException {
        public ArchiveNotFoundException(String archiveId) {
            super("Unknown corpus archive " + archiveId);
        }
    }

    private record ArchiveRecipe(
            Map<FederatedSourceSystem, Long> sourceCounts, FederatedCompositeCorpusManifest composition) {}

    private record ArchiveWriteResult(long recordCount, String archiveSha256, String logicalSha256) {}

    private record LogicalVerification(String sha256, long recordCount) {}

    private record SourceProbe(FreshnessStatus status, FreshnessMarker marker, String detail) {}
}
