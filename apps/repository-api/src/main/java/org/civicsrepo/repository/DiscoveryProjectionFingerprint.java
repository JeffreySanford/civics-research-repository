package org.civicsrepo.repository;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.MapperFeature;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.databind.json.JsonMapper;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Comparator;
import java.util.HexFormat;
import java.util.List;
import org.civicsrepo.search.DiscoveryDocument;

/**
 * Computes a stable identity for one normalized discovery projection.
 *
 * <p>The comparison demo needs to prove that Solr and OpenSearch received the same source document
 * set. A document count is not enough: two indexes can both contain 181 documents while holding
 * different metadata. This fingerprint is calculated before either engine sees the projection and
 * can therefore travel with both comparison results as evidence that their inputs were identical.
 *
 * <p>Document order is deliberately ignored because repository reads do not promise ordering. JSON
 * properties and map entries are sorted so the digest reflects projection content rather than
 * serialization accidents.
 */
public final class DiscoveryProjectionFingerprint {
    private static final JsonMapper OBJECT_MAPPER = JsonMapper.builder()
            .findAndAddModules()
            .enable(MapperFeature.SORT_PROPERTIES_ALPHABETICALLY)
            .enable(SerializationFeature.ORDER_MAP_ENTRIES_BY_KEYS)
            .build();

    private DiscoveryProjectionFingerprint() {}

    public static String fingerprint(List<DiscoveryDocument> documents) {
        List<DiscoveryDocument> canonicalDocuments = documents.stream()
                .sorted(Comparator.comparing((document) -> document.result().getId()))
                .toList();

        try {
            byte[] canonicalJson = OBJECT_MAPPER.writeValueAsBytes(canonicalDocuments);
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(canonicalJson));
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("Discovery projection could not be serialized for fingerprinting.", exception);
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is unavailable in this Java runtime.", exception);
        }
    }
}
