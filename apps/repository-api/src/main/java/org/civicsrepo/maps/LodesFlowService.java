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
    private final LodesOdFlowClient lodesOdFlowClient;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public LodesFlowService(CensusAreaBoundaryService censusAreaBoundaryService, LodesOdFlowClient lodesOdFlowClient) {
        this.censusAreaBoundaryService = censusAreaBoundaryService;
        this.lodesOdFlowClient = lodesOdFlowClient;
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
        boolean fallback = flows.stream().anyMatch(FlowSample::fallback);

        // The label says which it is. "Sample" was accurate when the numbers were always stored;
        // it now understates derived flows and would let a stored one pass for a measurement.
        String source = (fallback
                        ? "LEHD LODES %d stored sample - %s"
                        : "LEHD LODES %d origin-destination, aggregated to counties - %s")
                .formatted(VINTAGE, boundary.getGeography());

        return new LodesFlowOverlay(
                source,
                URI.create(sourceUrl),
                ATTRIBUTION,
                boundary.getGeography(),
                VINTAGE,
                fallback,
                objectMapper.convertValue(geoJson, java.util.Map.class),
                summaries);
    }

    /**
     * Real flows first, committed sample second, generated geometry last.
     *
     * <p>Each step down is a step further from the published data, and the overlay's {@code
     * fallback} flag says which one answered so the UI never presents a generated shape as a
     * measurement.
     */
    private List<FlowSample> loadFlows(String slug, CensusAreaBoundary boundary) {
        List<FlowSample> derived = deriveLiveFlows(slug);
        if (!derived.isEmpty()) {
            return derived;
        }

        try (InputStream input = getClass().getResourceAsStream("/maps/lodes-flow/" + slug + ".json")) {
            if (input != null) {
                JsonNode root = objectMapper.readTree(input);
                List<FlowSample> flows = new ArrayList<>();
                for (JsonNode node : root.path("flows")) {
                    // true: reaching this means the published file did not answer, and the reader
                    // is looking at a stored approximation rather than the current data.
                    flows.add(parseFlow(node, true));
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

    /** Aggregated from the published LODES origin-destination file, when it can be reached. */
    private List<FlowSample> deriveLiveFlows(String slug) {
        String abbreviation = abbreviationFor(slug);
        if (abbreviation.isBlank()) {
            return List.of();
        }

        return lodesOdFlowClient
                .findTopFlows(abbreviation)
                .map(flows -> flows.stream()
                        .map(flow -> new FlowSample(
                                flow.id(),
                                flow.originCountyName() + " County",
                                flow.destinationCountyName() + " County",
                                flow.workerCount(),
                                flow.originCountyName(),
                                flow.destinationCountyName(),
                                flow.originLongitude(),
                                flow.originLatitude(),
                                flow.destinationLongitude(),
                                flow.destinationLatitude(),
                                false))
                        .toList())
                .orElse(List.of());
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
        return StateAbbreviations.forSlug(slug);
    }



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
