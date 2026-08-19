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
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.zip.GZIPInputStream;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * Derives county-to-county commuting flows from the published LODES origin-destination file.
 *
 * <p>The map previously drew a small committed sample. It was labelled as a sample and it was still
 * misleading: it put Morton to Burleigh at 520 workers when the real 2023 figure is 8,615, and it
 * ranked a different flow first. A demonstration of Census data that gets Census numbers wrong by an
 * order of magnitude is worse than one that shows fewer of them.
 *
 * <p>So the flows are derived from the authoritative file at request time:
 *
 * <pre>
 *   {st}_od_main_JT00_{vintage}.csv.gz     ~1.8 MB, ~300k block-pair rows for North Dakota
 *        -> block GEOID truncated to its first 5 characters, which is the county FIPS
 *        -> summed by (home county, work county)
 *        -> intra-county pairs dropped
 *        -> largest N kept
 * </pre>
 *
 * <p>Intra-county pairs are dropped because they are the largest numbers in the file and they draw
 * nothing: a line from a county to itself is a dot. Cass County to Cass County is 87,272 jobs and
 * tells a reader only that most people work where they live.
 *
 * <p>Results are cached per state for the lifetime of the process. The vintage is an annual
 * publication, so there is nothing to invalidate within a run.
 */
@Component
public class LodesOdFlowClient {
    private static final Logger LOGGER = LoggerFactory.getLogger(LodesOdFlowClient.class);
    private static final Duration TIMEOUT = Duration.ofSeconds(90);
    private static final String URL_TEMPLATE =
            "https://lehd.ces.census.gov/data/lodes/LODES8/%s/od/%s_od_main_JT00_%d.csv.gz";

    private final HttpClient httpClient =
            HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();
    private final Map<String, List<CountyFlow>> cache = new ConcurrentHashMap<>();
    private final CountyGazetteer countyGazetteer;
    private final boolean enabled;
    private final int maxFlows;
    private final int vintage;
    private final long maxDownloadBytes;

    public LodesOdFlowClient(
            CountyGazetteer countyGazetteer,
            @Value("${civics.maps.lodes.live-enabled:true}") boolean enabled,
            @Value("${civics.maps.lodes.max-flows:8}") int maxFlows,
            @Value("${civics.maps.lodes.vintage:2023}") int vintage,
            @Value("${civics.maps.lodes.max-download-mb:30}") int maxDownloadMb) {
        this.countyGazetteer = countyGazetteer;
        this.enabled = enabled;
        this.maxFlows = maxFlows;
        this.vintage = vintage;
        this.maxDownloadBytes = (long) maxDownloadMb * 1024 * 1024;
    }

    /** One county-to-county commuting flow, with both endpoints resolved to real places. */
    public record CountyFlow(
            String id,
            String originCountyName,
            String destinationCountyName,
            int workerCount,
            double originLongitude,
            double originLatitude,
            double destinationLongitude,
            double destinationLatitude) {}

    public boolean isEnabled() {
        return enabled;
    }

    public int vintage() {
        return vintage;
    }

    public URI sourceUrl(String stateAbbreviation) {
        String state = stateAbbreviation.toLowerCase(java.util.Locale.ROOT);
        return URI.create(URL_TEMPLATE.formatted(state, state, vintage));
    }

    /**
     * The largest inter-county commuting flows for a state, or empty when they cannot be derived.
     *
     * <p>Empty is a real answer, not an error: the publisher may be unreachable, the state may not
     * participate in LEHD, or the Gazetteer may not have loaded. The caller falls back to its
     * committed sample and says so.
     */
    public Optional<List<CountyFlow>> findTopFlows(String stateAbbreviation) {
        if (!enabled) {
            return Optional.empty();
        }

        String state = stateAbbreviation.toLowerCase(java.util.Locale.ROOT);
        List<CountyFlow> cached = cache.get(state);
        if (cached != null) {
            return cached.isEmpty() ? Optional.empty() : Optional.of(cached);
        }

        List<CountyFlow> derived = derive(state);
        cache.put(state, derived);
        return derived.isEmpty() ? Optional.empty() : Optional.of(derived);
    }

    private List<CountyFlow> derive(String state) {
        if (!countyGazetteer.isAvailable()) {
            LOGGER.info("County gazetteer unavailable; LODES flows fall back to the committed sample.");
            return List.of();
        }

        Map<String, Integer> byCountyPair = new HashMap<>();
        URI uri = sourceUrl(state);

        // Published OD files run from 1.2 MB for Wyoming to 97 MB for California, and the large
        // ones carry tens of millions of block pairs. Deriving those on a map request would block
        // the workspace for a minute on first view, so they are declined rather than attempted:
        // a stored fallback that arrives is worth more than live data that never renders.
        if (!isWithinDownloadBudget(uri, state)) {
            return List.of();
        }

        try {
            HttpResponse<java.io.InputStream> response = httpClient.send(
                    HttpRequest.newBuilder(uri)
                            .timeout(TIMEOUT)
                            .header("User-Agent", "civics-research-repository/0.1 (+local demo)")
                            .GET()
                            .build(),
                    HttpResponse.BodyHandlers.ofInputStream());

            if (response.statusCode() >= 300) {
                LOGGER.info("LODES OD file for {} returned {}; using the committed sample.", state, response.statusCode());
                return List.of();
            }

            try (BufferedReader reader = new BufferedReader(
                    new InputStreamReader(new GZIPInputStream(response.body()), StandardCharsets.UTF_8))) {
                String header = reader.readLine();
                if (header == null) {
                    return List.of();
                }

                // Column order is stable across vintages, but reading it from the header means a
                // reordered file produces different numbers rather than silently wrong ones.
                List<String> columns = List.of(header.split(","));
                int workIndex = columns.indexOf("w_geocode");
                int homeIndex = columns.indexOf("h_geocode");
                int totalIndex = columns.indexOf("S000");
                if (workIndex < 0 || homeIndex < 0 || totalIndex < 0) {
                    LOGGER.warn("LODES OD file for {} has an unexpected header; using the committed sample.", state);
                    return List.of();
                }

                String line;
                while ((line = reader.readLine()) != null) {
                    String[] values = line.split(",");
                    if (values.length <= Math.max(totalIndex, Math.max(workIndex, homeIndex))) {
                        continue;
                    }

                    String workCounty = countyOf(values[workIndex]);
                    String homeCounty = countyOf(values[homeIndex]);
                    if (workCounty == null || homeCounty == null || workCounty.equals(homeCounty)) {
                        continue;
                    }

                    try {
                        byCountyPair.merge(
                                homeCounty + ">" + workCounty, Integer.parseInt(values[totalIndex].trim()), Integer::sum);
                    } catch (NumberFormatException exception) {
                        // One malformed row does not invalidate three hundred thousand good ones.
                    }
                }
            }
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            return List.of();
        } catch (Exception exception) {
            LOGGER.info("LODES OD file for {} could not be read ({}); using the committed sample.", state, exception.getMessage());
            return List.of();
        }

        List<CountyFlow> flows = byCountyPair.entrySet().stream()
                .sorted(Map.Entry.<String, Integer>comparingByValue().reversed())
                .map(this::toFlow)
                .filter(java.util.Objects::nonNull)
                .limit(maxFlows)
                .toList();

        LOGGER.info(
                "Derived {} commuting flows for {} from {} county pairs in the {} LODES OD file.",
                flows.size(),
                state.toUpperCase(java.util.Locale.ROOT),
                byCountyPair.size(),
                vintage);
        return flows;
    }

    /**
     * Asks how large the file is before committing to it.
     *
     * <p>A HEAD is one round trip against a static file host. Reading Content-Length from the GET
     * instead would mean the decision to abandon comes after the bytes have already been paid for.
     */
    private boolean isWithinDownloadBudget(URI uri, String state) {
        try {
            HttpResponse<Void> head = httpClient.send(
                    HttpRequest.newBuilder(uri)
                            .timeout(Duration.ofSeconds(20))
                            .header("User-Agent", "civics-research-repository/0.1 (+local demo)")
                            .method("HEAD", HttpRequest.BodyPublishers.noBody())
                            .build(),
                    HttpResponse.BodyHandlers.discarding());

            if (head.statusCode() >= 300) {
                // A 404 is a real answer: not every state participates in LEHD. Alaska has no
                // published OD file for any vintage.
                LOGGER.info("No LODES OD file published for {} ({}).", state.toUpperCase(java.util.Locale.ROOT), head.statusCode());
                return false;
            }

            long length = head.headers().firstValueAsLong("content-length").orElse(-1);
            if (length > maxDownloadBytes) {
                LOGGER.info(
                        "LODES OD file for {} is {} MB, above the {} MB budget; using the stored sample.",
                        state.toUpperCase(java.util.Locale.ROOT),
                        length / (1024 * 1024),
                        maxDownloadBytes / (1024 * 1024));
                return false;
            }

            return true;
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            return false;
        } catch (Exception exception) {
            LOGGER.info("Could not size the LODES OD file for {}: {}", state, exception.getMessage());
            return false;
        }
    }

    private CountyFlow toFlow(Map.Entry<String, Integer> entry) {
        String[] pair = entry.getKey().split(">");
        Optional<CountyGazetteer.County> origin = countyGazetteer.find(pair[0]);
        Optional<CountyGazetteer.County> destination = countyGazetteer.find(pair[1]);
        if (origin.isEmpty() || destination.isEmpty()) {
            return null;
        }

        return new CountyFlow(
                "lodes-%s-%s".formatted(pair[0], pair[1]),
                origin.orElseThrow().shortName(),
                destination.orElseThrow().shortName(),
                entry.getValue(),
                origin.orElseThrow().longitude(),
                origin.orElseThrow().latitude(),
                destination.orElseThrow().longitude(),
                destination.orElseThrow().latitude());
    }

    /** A Census block GEOID is 15 characters; its first five are the county FIPS. */
    private String countyOf(String blockGeocode) {
        String trimmed = blockGeocode.trim();
        return trimmed.length() >= 5 ? trimmed.substring(0, 5) : null;
    }
}
