package org.civicsrepo.evidence;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/**
 * Reads the generated C2 research artifacts and exposes only the stable evidence fields needed by
 * the product UI.
 *
 * <p>The browser never parses the raw benchmark artifacts. This service also refuses to combine a
 * performance report and statistical report from different search projections.
 */
@Service
public class SearchPerformanceEvidenceService {
    private static final Logger LOGGER = LoggerFactory.getLogger(SearchPerformanceEvidenceService.class);
    private static final String PROFILE = "FEDERATED_1M";
    private static final String STATISTICAL_REPORT = "search-comparison-statistical-report.json";
    private static final String RESEARCH_REPORT = "research-performance/federated-1m-report.json";
    private static final String POSITIVE_DIFFERENCE = "Positive differences mean OpenSearch took longer than Solr.";

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final Path evidenceRoot;

    public SearchPerformanceEvidenceService(
            @Value("${civics.search-evidence.path:browser-evidence-artifacts}") String evidencePath) {
        this.evidenceRoot = Path.of(evidencePath).toAbsolutePath().normalize();
    }

    public Optional<SearchPerformanceEvidence> latestEvidence() {
        Path statisticalPath = evidenceRoot.resolve(STATISTICAL_REPORT);
        Path researchPath = evidenceRoot.resolve(RESEARCH_REPORT);
        if (!Files.isRegularFile(statisticalPath) || !Files.isRegularFile(researchPath)) {
            return Optional.empty();
        }

        try {
            JsonNode statistical = objectMapper.readTree(statisticalPath.toFile());
            JsonNode research = objectMapper.readTree(researchPath.toFile());
            return Optional.of(toEvidence(research, statistical));
        } catch (IOException exception) {
            LOGGER.error("Failed to read C2 search performance evidence from {}", evidenceRoot, exception);
            throw new IllegalStateException("Could not read C2 search performance evidence", exception);
        }
    }

    private static SearchPerformanceEvidence toEvidence(JsonNode research, JsonNode statistical) {
        JsonNode paired = research.path("paired");
        String profile = paired.path("profile").asText();
        if (!PROFILE.equals(profile)) {
            throw new IllegalStateException("Search performance evidence must use the FEDERATED_1M profile");
        }

        String researchProjection = paired.path("projection").path("projectionId").asText();
        String statisticalProjection = statistical.path("projection").path("projectionId").asText();
        if (researchProjection.isBlank() || !researchProjection.equals(statisticalProjection)) {
            throw new IllegalStateException("Search performance evidence projection mismatch");
        }

        JsonNode researchEvidence = paired.path("evidence");
        return new SearchPerformanceEvidence(
                profile,
                statistical.path("capturedAt").asText(research.path("capturedAt").asText()),
                statistical.path("scope").asText(),
                statistical.path("comparativeClaimAllowed").asBoolean(false),
                statisticalProjection,
                paired.path("projection").path("objectCount").asLong(),
                researchEvidence.path("retainedFederatedRecordCount").asLong(),
                researchEvidence.path("targetParity").asBoolean(false),
                statistical.path("claimGuardrail").asText(),
                executionControls(statistical.path("executionControlEvidence")),
                standaloneBatch(statistical.path("batchLevelEvidence")),
                orderRobustness(statistical.path("orderRobustness")),
                pairedWorkloads(paired.path("passes")),
                concurrency(statistical),
                resources(statistical.path("resourceEvidence")));
    }

    private static SearchPerformanceEvidence.ExecutionControls executionControls(JsonNode node) {
        if (node.isMissingNode() || node.isNull()) {
            return null;
        }
        List<String> orders = new ArrayList<>();
        node.path("batchExecutionOrders").forEach(value -> orders.add(value.asText()));
        return new SearchPerformanceEvidence.ExecutionControls(
                text(node, "orderStrategy"),
                text(node, "requestedStartingOrder"),
                text(node, "realizedFirstBatchOrder"),
                longOrNull(node.get("seed")),
                node.path("seedApplied").asBoolean(false),
                intOrNull(node.get("batches")),
                intOrNull(node.get("measuredRunsPerBatch")),
                intOrNull(node.get("totalMeasuredRuns")),
                orders);
    }

    private static SearchPerformanceEvidence.BatchInference standaloneBatch(JsonNode node) {
        if (node.isMissingNode() || node.isNull()) {
            return null;
        }
        JsonNode workload = node.path("workload");
        return new SearchPerformanceEvidence.BatchInference(
                node.path("available").asBoolean(false),
                text(workload, "scenario"),
                text(workload, "query"),
                intOrNull(node.get("batchCount")),
                inference(node.path("apiElapsed").path("statistics")),
                inference(node.path("engineReported").path("statistics")),
                text(node, "experimentalUnit"));
    }

    private static SearchPerformanceEvidence.OrderRobustness orderRobustness(JsonNode node) {
        if (node.isMissingNode() || node.isNull()) {
            return null;
        }
        List<SearchPerformanceEvidence.OrderScenario> scenarios = new ArrayList<>();
        node.path("scenarios").forEach(scenario -> scenarios.add(new SearchPerformanceEvidence.OrderScenario(
                scenario.path("id").asText(),
                scenario.path("solrLeadsP50BothOrders").asBoolean(false),
                scenario.path("solrLeadsP95BothOrders").asBoolean(false))));
        return new SearchPerformanceEvidence.OrderRobustness(
                node.path("scenarioCount").asInt(scenarios.size()),
                node.path("solrLeadsP50BothOrdersCount").asInt(),
                node.path("solrLeadsP95BothOrdersCount").asInt(),
                scenarios);
    }

    private static List<SearchPerformanceEvidence.PairedWorkload> pairedWorkloads(JsonNode passes) {
        List<SearchPerformanceEvidence.PairedWorkload> rows = new ArrayList<>();
        appendPass(rows, passes.path("SOLR_FIRST"), "SOLR_FIRST");
        appendPass(rows, passes.path("OPENSEARCH_FIRST"), "OPENSEARCH_FIRST");
        return rows;
    }

    private static void appendPass(
            List<SearchPerformanceEvidence.PairedWorkload> rows, JsonNode pass, String executionOrder) {
        pass.path("scenarios").forEach(scenario -> rows.add(new SearchPerformanceEvidence.PairedWorkload(
                scenario.path("id").asText(),
                text(scenario, "workloadClass"),
                executionOrder,
                number(scenario.path("solr").path("elapsed").get("p50Ms")),
                number(scenario.path("solr").path("elapsed").get("p95Ms")),
                number(scenario.path("openSearch").path("elapsed").get("p50Ms")),
                number(scenario.path("openSearch").path("elapsed").get("p95Ms")),
                number(scenario.path("solr").path("engineReported").get("p50Ms")),
                number(scenario.path("solr").path("engineReported").get("p95Ms")),
                number(scenario.path("openSearch").path("engineReported").get("p50Ms")),
                number(scenario.path("openSearch").path("engineReported").get("p95Ms")))));
    }

    private static List<SearchPerformanceEvidence.ConcurrencyCell> concurrency(JsonNode statistical) {
        JsonNode batchRows = statistical.path("concurrencyBatchEvidence");
        List<SearchPerformanceEvidence.ConcurrencyCell> rows = new ArrayList<>();
        statistical.path("concurrencyEvidence").forEach(row -> {
            String workloadId = row.path("workloadId").asText();
            int clients = row.path("concurrency").asInt();
            JsonNode batch = matchingBatch(batchRows, workloadId, clients);
            rows.add(new SearchPerformanceEvidence.ConcurrencyCell(
                    workloadId,
                    text(row, "workloadClass"),
                    clients,
                    intOrNull(row.get("measuredComparisons")),
                    number(row.get("comparisonRequestsPerSecond")),
                    number(row.get("solrApiP50Ms")),
                    number(row.get("solrApiP95Ms")),
                    number(row.get("openSearchApiP50Ms")),
                    number(row.get("openSearchApiP95Ms")),
                    inferenceFromConcurrencyRow(row),
                    batchCell(batch)));
        });
        return rows;
    }

    private static JsonNode matchingBatch(JsonNode rows, String workloadId, int concurrency) {
        Iterator<JsonNode> iterator = rows.elements();
        while (iterator.hasNext()) {
            JsonNode row = iterator.next();
            if (workloadId.equals(row.path("workloadId").asText())
                    && concurrency == row.path("concurrency").asInt()) {
                return row;
            }
        }
        return null;
    }

    private static SearchPerformanceEvidence.BatchCellInference batchCell(JsonNode row) {
        if (row == null || row.isMissingNode() || row.isNull()) {
            return new SearchPerformanceEvidence.BatchCellInference(false, null, null);
        }
        boolean available = row.path("available").asBoolean(false);
        return new SearchPerformanceEvidence.BatchCellInference(
                available,
                intOrNull(row.get("batchCount")),
                available ? inference(row.path("apiElapsed").path("statistics")) : null);
    }

    private static SearchPerformanceEvidence.LatencyInference inferenceFromConcurrencyRow(JsonNode row) {
        JsonNode ci = row.path("pairedBootstrap95PercentCiMs");
        Double lower = ci.isArray() && ci.size() > 0 ? number(ci.get(0)) : null;
        Double upper = ci.isArray() && ci.size() > 1 ? number(ci.get(1)) : null;
        return new SearchPerformanceEvidence.LatencyInference(
                number(row.get("medianPairedDifferenceMs")),
                lower,
                upper,
                number(row.get("solrWinRatePercent")),
                excludesZero(lower, upper),
                POSITIVE_DIFFERENCE);
    }

    private static SearchPerformanceEvidence.LatencyInference inference(JsonNode statistics) {
        if (statistics.isMissingNode() || statistics.isNull()) {
            return null;
        }
        JsonNode bootstrap = statistics.path("bootstrap");
        Double lower = number(bootstrap.get("lowerMs"));
        Double upper = number(bootstrap.get("upperMs"));
        Boolean excludesZero = bootstrap.has("excludesZero")
                ? bootstrap.path("excludesZero").asBoolean()
                : excludesZero(lower, upper);
        return new SearchPerformanceEvidence.LatencyInference(
                number(statistics.get("medianDifferenceMs")),
                lower,
                upper,
                number(statistics.get("solrWinRatePercent")),
                excludesZero,
                statistics.path("interpretation").asText(POSITIVE_DIFFERENCE));
    }

    private static SearchPerformanceEvidence.ResourceSummary resources(JsonNode node) {
        if (node.isMissingNode() || node.isNull()) {
            return new SearchPerformanceEvidence.ResourceSummary(false, null, false, List.of());
        }
        List<String> resetFields = new ArrayList<>();
        node.path("counterResetFields").forEach(value -> resetFields.add(value.asText()));
        return new SearchPerformanceEvidence.ResourceSummary(
                true,
                text(node, "interpretation"),
                node.path("counterResetDetected").asBoolean(false),
                resetFields);
    }

    private static Boolean excludesZero(Double lower, Double upper) {
        if (lower == null || upper == null) {
            return null;
        }
        return lower > 0 || upper < 0;
    }

    private static String text(JsonNode node, String field) {
        JsonNode value = node.get(field);
        return value == null || value.isNull() || value.isMissingNode() ? null : value.asText();
    }

    private static Double number(JsonNode node) {
        return node == null || node.isNull() || !node.isNumber() ? null : node.asDouble();
    }

    private static Integer intOrNull(JsonNode node) {
        return node == null || node.isNull() || !node.canConvertToInt() ? null : node.asInt();
    }

    private static Long longOrNull(JsonNode node) {
        return node == null || node.isNull() || !node.canConvertToLong() ? null : node.asLong();
    }
}
