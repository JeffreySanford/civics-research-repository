package org.civicsrepo.search;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Base64;
import java.util.HexFormat;
import java.util.List;
import java.util.Objects;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * Encodes backend continuation state into an opaque request-bound cursor.
 *
 * <p>The token is intentionally not an authorization boundary: search filters still govern what a
 * caller can see. HMAC-SHA256 protects the backend position and request-binding metadata from client
 * editing, while explicit validation binds continuation to the active projection, normalized
 * criteria, page size, sort contract and backend. A stale or incompatible cursor fails instead of
 * silently restarting from page zero.
 */
@Component
public class SearchCursorCodec {
    static final int FORMAT_VERSION = 1;
    static final String SORT_VERSION = "relevance-id-v1";
    private static final String TOKEN_PREFIX = "v1";
    private static final String SIGNATURE_CONTEXT = "civics-search-cursor-v1\n";
    private static final String HMAC_ALGORITHM = "HmacSHA256";
    private static final String TEST_SECRET = "test-search-cursor-secret-32-bytes";

    private final ObjectMapper objectMapper;
    private final byte[] signingKey;

    @Autowired
    public SearchCursorCodec(@Value("${civics.search.cursor-secret}") String cursorSecret) {
        this(new ObjectMapper(), cursorSecret);
    }

    SearchCursorCodec(ObjectMapper objectMapper) {
        this(objectMapper, TEST_SECRET);
    }

    SearchCursorCodec(ObjectMapper objectMapper, String cursorSecret) {
        this.objectMapper = objectMapper;
        this.signingKey = requireSecret(cursorSecret).getBytes(StandardCharsets.UTF_8);
    }

    public String criteriaFingerprint(SearchComparisonCriteria criteria) {
        Objects.requireNonNull(criteria, "criteria");
        List<String> programs = criteria.programs().stream().sorted().toList();
        String canonical = String.join(
                "\n",
                "sort=" + SORT_VERSION,
                "query=" + criteria.query(),
                "programs=" + String.join("\u001f", programs),
                "publisher=" + text(criteria.publisher()),
                "sourceSystem=" + (criteria.sourceSystem() == null ? "" : criteria.sourceSystem().getValue()),
                "localId=" + text(criteria.localId()),
                "doi=" + text(criteria.doi()),
                "geography=" + text(criteria.geography()),
                "contentType=" + (criteria.contentType() == null ? "" : criteria.contentType().getValue()),
                "vintageYear=" + (criteria.vintageYear() == null ? "" : criteria.vintageYear()),
                "pageSize=" + criteria.pageSize());
        return sha256Hex(canonical);
    }

    public String encode(
            String projectionId,
            String criteriaFingerprint,
            String backend,
            int page,
            String position) {
        if (page < 0) {
            throw new IllegalArgumentException("page must be non-negative");
        }
        CursorPayload payload = new CursorPayload(
                FORMAT_VERSION,
                requireText(projectionId, "projectionId"),
                requireText(criteriaFingerprint, "criteriaFingerprint"),
                requireText(backend, "backend"),
                page,
                requireText(position, "position"));
        try {
            String encodedPayload = Base64.getUrlEncoder()
                    .withoutPadding()
                    .encodeToString(objectMapper.writeValueAsBytes(payload));
            return TOKEN_PREFIX + "." + encodedPayload + "." + signature(encodedPayload);
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("Search cursor payload could not be encoded.", exception);
        }
    }

    public SearchCursorState decodeAndValidate(
            String token,
            String expectedProjectionId,
            String expectedCriteriaFingerprint,
            String expectedBackend) {
        String normalizedToken = requireCursorToken(token);
        String[] segments = normalizedToken.split("\\.", -1);
        if (segments.length != 3 || !TOKEN_PREFIX.equals(segments[0])) {
            throw new SearchCursorException("Search cursor format is not supported.");
        }

        String expectedSignature = signature(segments[1]);
        if (!MessageDigest.isEqual(
                expectedSignature.getBytes(StandardCharsets.US_ASCII),
                segments[2].getBytes(StandardCharsets.US_ASCII))) {
            throw new SearchCursorException("Search cursor signature is not valid.");
        }

        CursorPayload payload;
        try {
            byte[] decoded = Base64.getUrlDecoder().decode(segments[1]);
            payload = objectMapper.readValue(decoded, CursorPayload.class);
        } catch (IllegalArgumentException | IOException exception) {
            throw new SearchCursorException("Search cursor payload is not valid.", exception);
        }

        if (payload.version() != FORMAT_VERSION) {
            throw new SearchCursorException("Search cursor version is not supported.");
        }
        if (!Objects.equals(payload.projectionId(), requireText(expectedProjectionId, "expectedProjectionId"))) {
            throw new SearchCursorException("Search cursor is stale because the active projection changed.");
        }
        if (!Objects.equals(
                payload.criteriaFingerprint(),
                requireText(expectedCriteriaFingerprint, "expectedCriteriaFingerprint"))) {
            throw new SearchCursorException("Search cursor does not match the current search criteria.");
        }
        if (!Objects.equals(payload.backend(), requireText(expectedBackend, "expectedBackend"))) {
            throw new SearchCursorException("Search cursor belongs to a different search backend.");
        }
        if (payload.page() < 0) {
            throw new SearchCursorException("Search cursor page is not valid.");
        }

        return new SearchCursorState(
                payload.projectionId(),
                payload.criteriaFingerprint(),
                payload.backend(),
                payload.page(),
                requireCursorPosition(payload.position()));
    }

    private String signature(String encodedPayload) {
        try {
            Mac mac = Mac.getInstance(HMAC_ALGORITHM);
            mac.init(new SecretKeySpec(signingKey, HMAC_ALGORITHM));
            return HexFormat.of().formatHex(mac.doFinal(
                    (SIGNATURE_CONTEXT + encodedPayload).getBytes(StandardCharsets.UTF_8)));
        } catch (GeneralSecurityException exception) {
            throw new IllegalStateException("HMAC-SHA256 is not available.", exception);
        }
    }

    private String requireCursorToken(String value) {
        if (value == null || value.isBlank()) {
            throw new SearchCursorException("Search cursor must not be blank.");
        }
        return value.trim();
    }

    private String requireCursorPosition(String value) {
        if (value == null || value.isBlank()) {
            throw new SearchCursorException("Search cursor continuation position is missing.");
        }
        return value;
    }

    private String requireText(String value, String field) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException(field + " must not be blank");
        }
        return value.trim();
    }

    private String requireSecret(String value) {
        if (value == null || value.length() < 16) {
            throw new IllegalArgumentException("civics.search.cursor-secret must contain at least 16 characters");
        }
        return value;
    }

    private String text(String value) {
        return value == null ? "" : value;
    }

    private String sha256Hex(String value) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is not available.", exception);
        }
    }

    private record CursorPayload(
            int version,
            String projectionId,
            String criteriaFingerprint,
            String backend,
            int page,
            String position) {}
}
