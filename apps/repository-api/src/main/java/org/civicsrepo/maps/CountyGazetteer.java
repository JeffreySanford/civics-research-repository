package org.civicsrepo.maps;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicReference;
import java.util.zip.ZipInputStream;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * County names and centroids, from the Census Gazetteer.
 *
 * <p>LODES identifies geography by Census block GEOID and nothing else: a row says 380170101001000,
 * not "Cass County". Turning a commuting flow into something a person can read, or a line a map can
 * draw, needs a county name and a point, and the Gazetteer is where the Census Bureau publishes
 * both. Hard-coding either would mean a table of 3,000 counties maintained by hand and wrong the
 * first time a county changed.
 *
 * <p>Fetched once and held. The file is ~140 KB and changes annually, so a per-request fetch would
 * spend more time on the lookup table than on the data it decorates.
 */
@Component
public class CountyGazetteer {
    private static final Logger LOGGER = LoggerFactory.getLogger(CountyGazetteer.class);
    private static final Duration TIMEOUT = Duration.ofSeconds(45);

    private final HttpClient httpClient =
            HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();
    private final AtomicReference<Map<String, County>> counties = new AtomicReference<>();
    private final String gazetteerUrl;

    public CountyGazetteer(
            @Value("${civics.maps.gazetteer-url:https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2025_Gazetteer/2025_Gaz_counties_national.zip}")
                    String gazetteerUrl) {
        this.gazetteerUrl = gazetteerUrl;
    }

    /** A county's readable name and interior point. */
    public record County(String fips, String name, String stateAbbreviation, double latitude, double longitude) {

        /** "Cass County" reads better as "Cass" beside another county name in a flow table. */
        public String shortName() {
            return name.replaceAll("\\s+(County|Parish|Borough|Census Area|Municipality|City and Borough)$", "");
        }
    }

    public Optional<County> find(String countyFips) {
        Map<String, County> loaded = counties.get();
        if (loaded == null) {
            loaded = load();
            if (loaded == null) {
                return Optional.empty();
            }
            counties.compareAndSet(null, loaded);
            loaded = counties.get();
        }
        return Optional.ofNullable(loaded.get(countyFips));
    }

    /** Whether the lookup table is available at all, so callers can fail before doing work. */
    public boolean isAvailable() {
        return find("38017").isPresent();
    }

    private Map<String, County> load() {
        try {
            HttpResponse<java.io.InputStream> response = httpClient.send(
                    HttpRequest.newBuilder(URI.create(gazetteerUrl))
                            .timeout(TIMEOUT)
                            .header("User-Agent", "civics-research-repository/0.1 (+local demo)")
                            .GET()
                            .build(),
                    HttpResponse.BodyHandlers.ofInputStream());

            if (response.statusCode() >= 300) {
                LOGGER.warn("Census Gazetteer returned {}; county names are unavailable.", response.statusCode());
                return null;
            }

            try (ZipInputStream zip = new ZipInputStream(response.body())) {
                if (zip.getNextEntry() == null) {
                    LOGGER.warn("Census Gazetteer archive was empty.");
                    return null;
                }

                // latin-1: the Gazetteer carries names such as Doña Ana County, and reading it as
                // UTF-8 turns those into replacement characters rather than failing loudly.
                BufferedReader reader = new BufferedReader(new InputStreamReader(zip, StandardCharsets.ISO_8859_1));
                Map<String, County> parsed = new HashMap<>();
                reader.readLine();

                String line;
                while ((line = reader.readLine()) != null) {
                    String[] columns = line.split("\\|");
                    if (columns.length < 11) {
                        continue;
                    }
                    try {
                        parsed.put(
                                columns[1].trim(),
                                new County(
                                        columns[1].trim(),
                                        columns[4].trim(),
                                        columns[0].trim(),
                                        Double.parseDouble(columns[9].trim()),
                                        Double.parseDouble(columns[10].trim())));
                    } catch (NumberFormatException exception) {
                        // A county without a usable interior point is skipped rather than failing
                        // the whole table: the flows that reference it simply will not resolve.
                    }
                }

                LOGGER.info("Loaded {} county centroids from the Census Gazetteer.", parsed.size());
                return Map.copyOf(parsed);
            }
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            return null;
        } catch (Exception exception) {
            LOGGER.warn("Census Gazetteer could not be read: {}", exception.getMessage());
            return null;
        }
    }
}
