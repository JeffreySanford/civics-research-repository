package org.civicsrepo.research;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;

class ResearchIdCodecTest {
    private final ResearchIdCodec codec = new ResearchIdCodec();

    @Test
    void roundTripsFederatedUrlIdentityAsOneUrlSafeSegment() {
        String identity = "DATA_GOV:https://data.transportation.gov/api/views/abcd-1234?agency=DOT&year=2026";

        String token = codec.encode(identity);

        assertThat(token).matches("^[A-Za-z0-9_-]+$");
        assertThat(token).doesNotContain("/", "+", "=");
        assertThat(codec.decode(token)).isEqualTo(identity);
    }

    @Test
    void roundTripsUtf8Identity() {
        String identity = "OPENALEX:https://openalex.org/W123/Überblick";

        assertThat(codec.decode(codec.encode(identity))).isEqualTo(identity);
    }

    @Test
    void rejectsCharactersOutsideTheUrlSafeAlphabet() {
        assertThatThrownBy(() -> codec.decode("abc/def="))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Invalid research identity token");
    }

    @Test
    void rejectsDecodedControlCharacters() {
        String token = codec.encode("DATA_GOV:valid");
        String controlToken = java.util.Base64.getUrlEncoder()
                .withoutPadding()
                .encodeToString("DATA_GOV:bad\u0000id".getBytes(java.nio.charset.StandardCharsets.UTF_8));

        assertThat(codec.decode(token)).isEqualTo("DATA_GOV:valid");
        assertThatThrownBy(() -> codec.decode(controlToken))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("printable text");
    }
}
