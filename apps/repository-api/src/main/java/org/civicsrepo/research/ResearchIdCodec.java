package org.civicsrepo.research;

import static java.nio.charset.StandardCharsets.UTF_8;

import java.nio.ByteBuffer;
import java.nio.charset.CharacterCodingException;
import java.nio.charset.CodingErrorAction;
import java.util.Base64;
import java.util.regex.Pattern;
import org.springframework.stereotype.Component;

/**
 * Encodes canonical research-object identities into one URL-safe path segment.
 *
 * <p>Federated identities deliberately preserve the source identifier, so a Data.gov identity can
 * contain a complete HTTPS URL. Treating that identity as a raw path parameter would make slashes
 * structural and would couple routing to every source's identifier syntax. URL-safe Base64 keeps
 * the persistence identity unchanged while giving the HTTP route an opaque, reversible token.
 */
@Component
public final class ResearchIdCodec {
    static final int MAX_TOKEN_LENGTH = 4096;
    private static final Pattern TOKEN = Pattern.compile("[A-Za-z0-9_-]+");

    public String encode(String canonicalId) {
        validateCanonicalId(canonicalId);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(canonicalId.getBytes(UTF_8));
    }

    public String decode(String token) {
        if (token == null || token.isBlank() || token.length() > MAX_TOKEN_LENGTH || !TOKEN.matcher(token).matches()) {
            throw new IllegalArgumentException("Invalid research identity token.");
        }

        final byte[] bytes;
        try {
            bytes = Base64.getUrlDecoder().decode(token);
        } catch (IllegalArgumentException exception) {
            throw new IllegalArgumentException("Invalid research identity token.", exception);
        }

        final String canonicalId;
        try {
            canonicalId = UTF_8.newDecoder()
                    .onMalformedInput(CodingErrorAction.REPORT)
                    .onUnmappableCharacter(CodingErrorAction.REPORT)
                    .decode(ByteBuffer.wrap(bytes))
                    .toString();
        } catch (CharacterCodingException exception) {
            throw new IllegalArgumentException("Research identity token is not valid UTF-8.", exception);
        }

        validateCanonicalId(canonicalId);
        return canonicalId;
    }

    private static void validateCanonicalId(String canonicalId) {
        if (canonicalId == null || canonicalId.isBlank() || canonicalId.codePoints().anyMatch(Character::isISOControl)) {
            throw new IllegalArgumentException("Research identity must contain printable text.");
        }
    }
}
