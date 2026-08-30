package org.civicsrepo.repository;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.MapperFeature;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.databind.json.JsonMapper;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.List;
import org.civicsrepo.search.DiscoveryDocument;

/**
 * Incremental deterministic identity for an already-canonical discovery-document sequence.
 *
 * <p>The caller owns record order. PI-1 uses {@code CombinedDiscoveryCatalog}, whose authority and
 * stable-ID ordering is deterministic. Batch boundaries are deliberately absent from the digest:
 * each document contributes one length-prefixed canonical JSON value, so 500-document and
 * 2,000-document bulk sizes produce the same projection identity for the same ordered records.
 */
public final class DiscoveryProjectionDigest {
    public static final String FORMAT_VERSION = "crr-discovery-document-stream-v1";

    private static final JsonMapper OBJECT_MAPPER = JsonMapper.builder()
            .findAndAddModules()
            .enable(MapperFeature.SORT_PROPERTIES_ALPHABETICALLY)
            .enable(SerializationFeature.ORDER_MAP_ENTRIES_BY_KEYS)
            .build();

    private final MessageDigest digest;
    private long documentCount;
    private boolean finished;

    public DiscoveryProjectionDigest() {
        try {
            digest = MessageDigest.getInstance("SHA-256");
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is unavailable in this Java runtime.", exception);
        }
        byte[] version = FORMAT_VERSION.getBytes(StandardCharsets.UTF_8);
        digest.update(ByteBuffer.allocate(Integer.BYTES).putInt(version.length).array());
        digest.update(version);
    }

    public void update(DiscoveryDocument document) {
        ensureOpen();
        if (document == null) {
            throw new IllegalArgumentException("document must not be null");
        }
        try {
            byte[] canonicalJson = OBJECT_MAPPER.writeValueAsBytes(document);
            digest.update(ByteBuffer.allocate(Integer.BYTES).putInt(canonicalJson.length).array());
            digest.update(canonicalJson);
            documentCount++;
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("Discovery document could not be serialized for fingerprinting.", exception);
        }
    }

    public void updateBatch(List<DiscoveryDocument> documents) {
        ensureOpen();
        if (documents == null) {
            throw new IllegalArgumentException("documents must not be null");
        }
        documents.forEach(this::update);
    }

    public long documentCount() {
        return documentCount;
    }

    public String finish() {
        ensureOpen();
        finished = true;
        return HexFormat.of().formatHex(digest.digest());
    }

    private void ensureOpen() {
        if (finished) {
            throw new IllegalStateException("Projection digest has already been finished.");
        }
    }
}
