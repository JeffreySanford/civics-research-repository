package org.civicsrepo.admin;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.URI;
import java.net.http.HttpClient;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Clock;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import org.civicsrepo.admin.CorpusArchiveService.ArchiveNotFoundException;
import org.civicsrepo.admin.CorpusArchiveService.FreshnessStatus;
import org.civicsrepo.admin.CorpusArchiveService.IntegrityStatus;
import org.civicsrepo.federation.CorpusProfile;
import org.civicsrepo.federation.FederatedCompositeCorpusManifestStore;
import org.civicsrepo.federation.FederatedCompositeCorpusProjectionService;
import org.civicsrepo.federation.FederatedMetadataCatalog;
import org.civicsrepo.federation.FederatedResearchRecord;
import org.civicsrepo.federation.FederatedSourceSystem;
import org.civicsrepo.federation.HarvestCheckpoint;
import org.civicsrepo.federation.HarvestCheckpointStore;
import org.civicsrepo.federation.HarvestRun;
import org.civicsrepo.federation.HarvestRunStore;
import org.civicsrepo.generated.dto.ResearchObjectType;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class CorpusArchiveServiceTest {
    private static final Clock CLOCK =
            Clock.fixed(Instant.parse("2026-08-31T23:45:00Z"), ZoneOffset.UTC);

    @TempDir
    Path tempDir;

    @Test
    void createsVerifiesAndDeletesPortableFullArchive() throws Exception {
        InMemoryCatalog catalog = new InMemoryCatalog(List.of(
                record("NASA_CMR", "001"),
                record("NASA_CMR", "002")));
        CorpusArchiveService service = service(catalog);

        CorpusArchiveService.CorpusArchiveSummary created =
                service.create(CorpusProfile.FULL, "Two-record proof");

        assertEquals("Two-record proof", created.label());
        assertEquals(2, created.recordCount());
        assertEquals(2L, created.sourceCounts().get(FederatedSourceSystem.NASA_CMR));
        assertEquals(IntegrityStatus.NOT_CHECKED, created.integrityStatus());
        assertEquals(FreshnessStatus.NOT_CHECKED, created.freshnessStatus());
        assertTrue(created.archiveSha256().matches("[0-9a-f]{64}"));
        assertTrue(created.logicalSha256().matches("[0-9a-f]{64}"));

        Path archiveDirectory = tempDir.resolve(created.archiveId());
        assertTrue(Files.isRegularFile(archiveDirectory.resolve("manifest.json")));
        assertTrue(Files.isRegularFile(archiveDirectory.resolve("status.json")));
        assertTrue(Files.isRegularFile(archiveDirectory.resolve("federated-records.jsonl.gz")));

        CorpusArchiveService.CorpusArchiveSummary verified = service.verify(created.archiveId());
        assertEquals(IntegrityStatus.VERIFIED, verified.integrityStatus());
        assertEquals(2, verified.recordCount());

        service.delete(created.archiveId());
        assertFalse(Files.exists(archiveDirectory));
        assertThrows(ArchiveNotFoundException.class, () -> service.verify(created.archiveId()));
    }

    @Test
    void corruptedArchiveFailsVerificationInsteadOfBlessingNewBytes() throws Exception {
        InMemoryCatalog catalog = new InMemoryCatalog(List.of(record("NASA_CMR", "001")));
        CorpusArchiveService service = service(catalog);
        CorpusArchiveService.CorpusArchiveSummary created = service.create(CorpusProfile.FULL, "Integrity proof");

        Path records = tempDir.resolve(created.archiveId()).resolve("federated-records.jsonl.gz");
        Files.write(records, new byte[] {1, 2, 3, 4});

        assertThrows(IllegalStateException.class, () -> service.verify(created.archiveId()));
    }

    private CorpusArchiveService service(FederatedMetadataCatalog catalog) {
        return new CorpusArchiveService(
                catalog,
                mock(FederatedCompositeCorpusManifestStore.class),
                mock(FederatedCompositeCorpusProjectionService.class),
                new EmptyCheckpointStore(),
                new EmptyRunStore(),
                mock(CorpusProfileActivationService.class),
                new ObjectMapper().findAndRegisterModules(),
                tempDir,
                mock(HttpClient.class),
                CLOCK,
                "https://example.test/datagov",
                "test-key",
                "https://example.test/osti");
    }

    private FederatedResearchRecord record(String source, String id) {
        FederatedSourceSystem sourceSystem = FederatedSourceSystem.valueOf(source);
        return new FederatedResearchRecord(
                sourceSystem,
                id,
                "Title " + id,
                "Summary",
                "Publisher",
                "Program",
                ResearchObjectType.DATASET,
                URI.create("https://example.test/" + id),
                OffsetDateTime.parse("2026-08-31T20:00:00Z"),
                OffsetDateTime.parse("2026-08-31T20:01:00Z"),
                "test-v1",
                List.of("Author"),
                List.of("Subject"),
                java.util.Map.of("marker", id));
    }

    private static final class InMemoryCatalog implements FederatedMetadataCatalog {
        private final List<FederatedResearchRecord> records = new ArrayList<>();

        private InMemoryCatalog(List<FederatedResearchRecord> initial) {
            records.addAll(initial);
            records.sort(Comparator.comparing(FederatedResearchRecord::id));
        }

        @Override
        public void upsertBatch(List<FederatedResearchRecord> batch) {
            for (FederatedResearchRecord record : batch) {
                records.removeIf(existing -> existing.id().equals(record.id()));
                records.add(record);
            }
            records.sort(Comparator.comparing(FederatedResearchRecord::id));
        }

        @Override
        public Optional<FederatedResearchRecord> findById(String id) {
            return records.stream().filter(record -> record.id().equals(id)).findFirst();
        }

        @Override
        public List<FederatedResearchRecord> findAfterId(String afterId, int limit) {
            return records.stream()
                    .filter(record -> afterId == null || record.id().compareTo(afterId) > 0)
                    .limit(limit)
                    .toList();
        }

        @Override
        public List<FederatedResearchRecord> findSourceAfterId(
                FederatedSourceSystem sourceSystem, String afterId, int limit) {
            String cursor = afterId == null ? sourceSystem.name() + ":" : afterId;
            return records.stream()
                    .filter(record -> record.sourceSystem() == sourceSystem)
                    .filter(record -> record.id().compareTo(cursor) > 0)
                    .limit(limit)
                    .toList();
        }

        @Override
        public long count() {
            return records.size();
        }

        @Override
        public long count(FederatedSourceSystem sourceSystem) {
            return records.stream().filter(record -> record.sourceSystem() == sourceSystem).count();
        }

        @Override
        public void deleteAll() {
            records.clear();
        }
    }

    private static final class EmptyCheckpointStore implements HarvestCheckpointStore {
        @Override
        public Optional<HarvestCheckpoint> find(FederatedSourceSystem sourceSystem) {
            return Optional.empty();
        }

        @Override
        public void save(HarvestCheckpoint checkpoint) {}

        @Override
        public void clear(FederatedSourceSystem sourceSystem) {}
    }

    private static final class EmptyRunStore implements HarvestRunStore {
        @Override
        public void save(HarvestRun run) {}

        @Override
        public Optional<HarvestRun> findById(String id) {
            return Optional.empty();
        }

        @Override
        public Optional<HarvestRun> findResumable(FederatedSourceSystem sourceSystem) {
            return Optional.empty();
        }

        @Override
        public List<HarvestRun> findRecent(FederatedSourceSystem sourceSystem, int limit) {
            return List.of();
        }
    }
}
