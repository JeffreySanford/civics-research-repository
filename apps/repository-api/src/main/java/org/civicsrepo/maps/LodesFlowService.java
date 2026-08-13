package org.civicsrepo.maps;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.io.IOException;
import java.io.InputStream;
import java.net.URI;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.civicsrepo.generated.dto.CensusAreaBoundary;
import org.civicsrepo.generated.dto.LodesFlowOverlay;
import org.civicsrepo.generated.dto.LodesFlowSummary;
import org.springframework.stereotype.Service;

/**
 * Serves a small LEHD LODES origin-destination flow sample per Census area.
 *
 * <p>Full state OD CSV archives stay on the publisher site; this endpoint returns a bounded GeoJSON
 * sample derived from 2023 LODES main flows for the selected state.
 */
@Service
public class LodesFlowService {
    private static final int VINTAGE = 2023;
    private static final String ATTRIBUTION =
            "U.S. Census Bureau LEHD Origin-Destination Employment Statistics";
    private static final String SOURCE_URL_TEMPLATE =
            "https://lehd.ces.census.gov/data/lodes/LODES8/%s/od/%s_od_main_JT00_%d.csv.gz";

    private final CensusAreaBoundaryService censusAreaBoundaryService;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public LodesFlowService(CensusAreaBoundaryService censusAreaBoundaryService) {
        this.censusAreaBoundaryService = censusAreaBoundaryService;
    }

    public LodesFlowOverlay findFlowSample(String geography) {
        CensusAreaBoundary boundary = resolveBoundary(geography);
        String slug = boundary.getId();
        String abbreviation = abbreviationFor(slug);
        List<FlowSample> flows = loadFlows(slug, boundary);

        ObjectNode geoJson = objectMapper.createObjectNode();
        geoJson.put("type", "FeatureCollection");
        ArrayNode features = geoJson.putArray("features");

        List<LodesFlowSummary> summaries = new ArrayList<>();
        for (FlowSample flow : flows) {
            summaries.add(new LodesFlowSummary(
                    flow.id(),
                    flow.originLabel(),
                    flow.destinationLabel(),
                    flow.workerCount(),
                    flow.originCounty(),
                    flow.destinationCounty()));

            ObjectNode lineFeature = objectMapper.createObjectNode();
            lineFeature.put("type", "Feature");
            ObjectNode lineProperties = lineFeature.putObject("properties");
            lineProperties.put("id", flow.id());
            lineProperties.put("label", flow.originLabel() + " to " + flow.destinationLabel());
            lineProperties.put("workerCount", flow.workerCount());
            ObjectNode lineGeometry = lineFeature.putObject("geometry");
            lineGeometry.put("type", "LineString");
            ArrayNode lineCoordinates = lineGeometry.putArray("coordinates");
            lineCoordinates.addArray().add(flow.originLongitude()).add(flow.originLatitude());
            lineCoordinates.addArray().add(flow.destinationLongitude()).add(flow.destinationLatitude());
            features.add(lineFeature);

            addPoint(features, flow.originLabel() + " (home)", flow.originLongitude(), flow.originLatitude());
            addPoint(features, flow.destinationLabel() + " (work)", flow.destinationLongitude(), flow.destinationLatitude());
        }

        String sourceUrl = SOURCE_URL_TEMPLATE.formatted(abbreviation, abbreviation, VINTAGE);
        return new LodesFlowOverlay(
                "LEHD LODES " + VINTAGE + " main OD sample - " + boundary.getGeography(),
                URI.create(sourceUrl),
                ATTRIBUTION,
                boundary.getGeography(),
                VINTAGE,
                flows.stream().anyMatch(FlowSample::fallback),
                objectMapper.convertValue(geoJson, java.util.Map.class),
                summaries);
    }

    private List<FlowSample> loadFlows(String slug, CensusAreaBoundary boundary) {
        try (InputStream input = getClass().getResourceAsStream("/maps/lodes-flow/" + slug + ".json")) {
            if (input != null) {
                JsonNode root = objectMapper.readTree(input);
                List<FlowSample> flows = new ArrayList<>();
                for (JsonNode node : root.path("flows")) {
                    flows.add(parseFlow(node, false));
                }
                if (!flows.isEmpty()) {
                    return flows;
                }
            }
        } catch (IOException exception) {
            // Fall through to generated sample for the area bbox.
        }

        return generatedFlows(boundary);
    }

    private FlowSample parseFlow(JsonNode node, boolean fallback) {
        return new FlowSample(
                node.path("id").asText(),
                node.path("originLabel").asText(),
                node.path("destinationLabel").asText(),
                node.path("workerCount").asInt(),
                node.path("originCounty").asText(),
                node.path("destinationCounty").asText(),
                node.path("originLongitude").asDouble(),
                node.path("originLatitude").asDouble(),
                node.path("destinationLongitude").asDouble(),
                node.path("destinationLatitude").asDouble(),
                fallback);
    }

    private List<FlowSample> generatedFlows(CensusAreaBoundary boundary) {
        double west = boundary.getWest();
        double south = boundary.getSouth();
        double east = boundary.getEast();
        double north = boundary.getNorth();
        double width = east - west;
        double height = north - south;

        return List.of(
                new FlowSample(
                        boundary.getId() + "-flow-west-east",
                        boundary.getGeography() + " western workforce",
                        boundary.getGeography() + " eastern workplace",
                        420,
                        "Western county",
                        "Eastern county",
                        west + width * 0.22,
                        south + height * 0.45,
                        west + width * 0.78,
                        south + height * 0.58,
                        true),
                new FlowSample(
                        boundary.getId() + "-flow-south-center",
                        boundary.getGeography() + " southern residential",
                        boundary.getGeography() + " central workplace",
                        280,
                        "Southern county",
                        "Central county",
                        west + width * 0.35,
                        south + height * 0.28,
                        west + width * 0.52,
                        south + height * 0.62,
                        true),
                new FlowSample(
                        boundary.getId() + "-flow-north-south",
                        boundary.getGeography() + " northern residential",
                        boundary.getGeography() + " southern workplace",
                        190,
                        "Northern county",
                        "Southern county",
                        west + width * 0.48,
                        south + height * 0.78,
                        west + width * 0.64,
                        south + height * 0.35,
                        true));
    }

    private void addPoint(ArrayNode features, String label, double longitude, double latitude) {
        ObjectNode pointFeature = objectMapper.createObjectNode();
        pointFeature.put("type", "Feature");
        pointFeature.putObject("properties").put("label", label);
        ObjectNode geometry = pointFeature.putObject("geometry");
        geometry.put("type", "Point");
        geometry.putArray("coordinates").add(longitude).add(latitude);
        features.add(pointFeature);
    }

    private CensusAreaBoundary resolveBoundary(String geography) {
        return censusAreaBoundaryService.listBoundaries().stream()
                .filter((boundary) -> boundary.getGeography().equalsIgnoreCase(geography))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("Unknown geography: " + geography));
    }

    private String abbreviationFor(String slug) {
        return STATE_ABBREVIATIONS.getOrDefault(slug, slug.substring(0, Math.min(2, slug.length())));
    }

    private static final Map<String, String> STATE_ABBREVIATIONS = Map.ofEntries(
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

    private record FlowSample(
            String id,
            String originLabel,
            String destinationLabel,
            int workerCount,
            String originCounty,
            String destinationCounty,
            double originLongitude,
            double originLatitude,
            double destinationLongitude,
            double destinationLatitude,
            boolean fallback) {}
}
