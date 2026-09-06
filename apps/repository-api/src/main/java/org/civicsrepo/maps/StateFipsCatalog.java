package org.civicsrepo.maps;

import java.util.Locale;
import java.util.Map;

/** Canonical state/DC/Puerto Rico FIPS codes used by county thematic services. */
final class StateFipsCatalog {
    private static final Map<String, String> BY_NAME = Map.ofEntries(
            Map.entry("alabama", "01"),
            Map.entry("alaska", "02"),
            Map.entry("arizona", "04"),
            Map.entry("arkansas", "05"),
            Map.entry("california", "06"),
            Map.entry("colorado", "08"),
            Map.entry("connecticut", "09"),
            Map.entry("delaware", "10"),
            Map.entry("district of columbia", "11"),
            Map.entry("florida", "12"),
            Map.entry("georgia", "13"),
            Map.entry("hawaii", "15"),
            Map.entry("idaho", "16"),
            Map.entry("illinois", "17"),
            Map.entry("indiana", "18"),
            Map.entry("iowa", "19"),
            Map.entry("kansas", "20"),
            Map.entry("kentucky", "21"),
            Map.entry("louisiana", "22"),
            Map.entry("maine", "23"),
            Map.entry("maryland", "24"),
            Map.entry("massachusetts", "25"),
            Map.entry("michigan", "26"),
            Map.entry("minnesota", "27"),
            Map.entry("mississippi", "28"),
            Map.entry("missouri", "29"),
            Map.entry("montana", "30"),
            Map.entry("nebraska", "31"),
            Map.entry("nevada", "32"),
            Map.entry("new hampshire", "33"),
            Map.entry("new jersey", "34"),
            Map.entry("new mexico", "35"),
            Map.entry("new york", "36"),
            Map.entry("north carolina", "37"),
            Map.entry("north dakota", "38"),
            Map.entry("ohio", "39"),
            Map.entry("oklahoma", "40"),
            Map.entry("oregon", "41"),
            Map.entry("pennsylvania", "42"),
            Map.entry("rhode island", "44"),
            Map.entry("south carolina", "45"),
            Map.entry("south dakota", "46"),
            Map.entry("tennessee", "47"),
            Map.entry("texas", "48"),
            Map.entry("utah", "49"),
            Map.entry("vermont", "50"),
            Map.entry("virginia", "51"),
            Map.entry("washington", "53"),
            Map.entry("west virginia", "54"),
            Map.entry("wisconsin", "55"),
            Map.entry("wyoming", "56"),
            Map.entry("puerto rico", "72"));

    private StateFipsCatalog() {}

    static String forGeography(String geography) {
        if (geography == null || geography.isBlank()) {
            throw new IllegalArgumentException("Geography must not be blank.");
        }

        String fips = BY_NAME.get(geography.strip().toLowerCase(Locale.ROOT));
        if (fips == null) {
            throw new IllegalArgumentException("Unsupported state geography: " + geography + ".");
        }
        return fips;
    }
}
