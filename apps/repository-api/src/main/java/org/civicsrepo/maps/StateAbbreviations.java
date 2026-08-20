package org.civicsrepo.maps;

import java.util.Locale;
import java.util.Map;

/**
 * Census area slug to USPS state abbreviation.
 *
 * <p>LEHD builds every file path from the two-letter abbreviation, and the application identifies
 * areas by slug. Two services now need the same translation, so it lives in one place: a second
 * copy would drift the first time a territory was added to one and not the other.
 */
public final class StateAbbreviations {

    private StateAbbreviations() {}

    /** The abbreviation for a slug, or an empty string when the slug names no state LEHD publishes. */
    public static String forSlug(String slug) {
        if (slug == null || slug.isBlank()) {
            return "";
        }
        return BY_SLUG.getOrDefault(slug.toLowerCase(Locale.ROOT), "");
    }

    private static final Map<String, String> BY_SLUG = Map.ofEntries(
            Map.entry("alabama", "al"),
            Map.entry("alaska", "ak"),
            Map.entry("arizona", "az"),
            Map.entry("arkansas", "ar"),
            Map.entry("california", "ca"),
            Map.entry("colorado", "co"),
            Map.entry("connecticut", "ct"),
            Map.entry("delaware", "de"),
            Map.entry("district-of-columbia", "dc"),
            Map.entry("florida", "fl"),
            Map.entry("georgia", "ga"),
            Map.entry("hawaii", "hi"),
            Map.entry("idaho", "id"),
            Map.entry("illinois", "il"),
            Map.entry("indiana", "in"),
            Map.entry("iowa", "ia"),
            Map.entry("kansas", "ks"),
            Map.entry("kentucky", "ky"),
            Map.entry("louisiana", "la"),
            Map.entry("maine", "me"),
            Map.entry("maryland", "md"),
            Map.entry("massachusetts", "ma"),
            Map.entry("michigan", "mi"),
            Map.entry("minnesota", "mn"),
            Map.entry("mississippi", "ms"),
            Map.entry("missouri", "mo"),
            Map.entry("montana", "mt"),
            Map.entry("nebraska", "ne"),
            Map.entry("nevada", "nv"),
            Map.entry("new-hampshire", "nh"),
            Map.entry("new-jersey", "nj"),
            Map.entry("new-mexico", "nm"),
            Map.entry("new-york", "ny"),
            Map.entry("north-carolina", "nc"),
            Map.entry("north-dakota", "nd"),
            Map.entry("ohio", "oh"),
            Map.entry("oklahoma", "ok"),
            Map.entry("oregon", "or"),
            Map.entry("pennsylvania", "pa"),
            Map.entry("puerto-rico", "pr"),
            Map.entry("rhode-island", "ri"),
            Map.entry("south-carolina", "sc"),
            Map.entry("south-dakota", "sd"),
            Map.entry("tennessee", "tn"),
            Map.entry("texas", "tx"),
            Map.entry("utah", "ut"),
            Map.entry("vermont", "vt"),
            Map.entry("virginia", "va"),
            Map.entry("washington", "wa"),
            Map.entry("west-virginia", "wv"),
            Map.entry("wisconsin", "wi"),
            Map.entry("wyoming", "wy"));
}
