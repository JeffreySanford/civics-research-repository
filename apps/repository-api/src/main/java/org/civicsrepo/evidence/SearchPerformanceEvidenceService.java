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
    private static final String C21_STATISTICAL_REPORT = "c2-1/statistical-report.json";
    private static final String C21_EXPERIMENT = "C2.1_ADVERSARIAL_STANDALONE";
    private static final String C21_REPORT_KIND = "c2-1-statistical-report";
    private static final String C21_TREATMENT = "C2_1_OPTIMIZED_EQUIVALENT";
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
        Path c21Path = evidenceRoot.resolve(C21_STATISTICAL_REPORT);
        if (!Files.isRegularFile(statisticalPath) || !Files.isRegularFile(researchPath)) {
            return Optional.empty();
        }

        try {
            JsonNode statistical = objectMapper.readTree(statisticalPath.toFile());
            JsonNode research = objectMapper.readTree(researchPath.toFile());
            JsonNode c21 = Files.isRegularFile(c21Path) ? objectMapper.readTree(c21Path.toFile()) : null;
            return Optional.of(toEvidence(research, statistical, c21));
        } catch (IOException exception) {
            LOGGER.error("Failed to read C2 search performance evidence from {}", evidenceRoot, exception);
            throw new IllegalStateException("Could not read C2 search performance evidence", exception);
        }
    }

    private static SearchPerformanceEvidence toEvidence(JsonNode research, JsonNode statistical, JsonNode c21) {
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

        long projectionObjectCount = paired.path("projection").path("objectCount").asLong();
        JsonNode researchEvidence = paired.path("evidence");
        return new SearchPerformanceEvidence(
                profile,
                statistical.path("capturedAt").asText(research.path("capturedAt").asText()),
                statistical.path("scope").asText(),
                statistical.path("comparativeClaimAllowed").asBoolean(false),
                statisticalProjection,
                projectionObjectCount,
                researchEvidence.path("retainedFederatedRecordCount").asLong(),
                researchEvidence.path("targetParity").asBoolean(false),
                statistical.path("claimGuardrail").asText(),
                executionControls(statistical.path("executionControlEvidence")),
                standaloneBatch(statistical.path("batchLevelEvidence")),
                orderRobustness(statistical.path("orderRobustness")),
                pairedWorkloads(paired.path("passes")),
                concurrency(statistical),
                c21Adversarial(c21, statisticalProjection, projectionObjectCount),
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

    private static SearchPerformanceEvidence.C21AdversarialEvidence c21Adversarial(
            JsonNode node, String projectionId, long projectionObjectCount) {
        if (node == null || node.isMissingNode() || node.isNull()) {
            return null;
        }
        if (!C21_EXPERIMENT.equals(node.path("experiment").asText())
                || !C21_REPORT_KIND.equals(node.path("kind").asText())) {
            throw new IllegalStateException("C2.1 evidence is not the admitted adversarial statistical report");
        }
        if (node.path("comparativeClaimAllowed").asBoolean(true)) {
            throw new IllegalStateException("C2.1 evidence must retain the comparative-claim guardrail");
        }
        if (!projectionId.equals(node.path("projectionId").asText())
                || projectionObjectCount != node.path("projectionObjectCount").asLong(-1)) {
            throw new IllegalStateException("C2.1 evidence projection mismatch");
        }
        if (!C21_TREATMENT.equals(node.path("openSearchTreatment").asText())) {
            throw new IllegalStateException("C2.1 evidence treatment mismatch");
        }

        JsonNode inferenceContract = node.path("inferenceContract");
        int restartBlocks = inferenceContract.path("restartBlocks").asInt(-1);
        int independentBatches = inferenceContract.path("independentBatchSummariesPerCell").asInt(-1);
        if (restartBlocks != 4 || independentBatches != 16) {
            throw new IllegalStateException("C2.1 evidence does not match the accepted 4-block / 16-batch design");
        }

        JsonNode summary = node.path("summary");
        JsonNode apiSummary = summary.path("apiElapsed");
        int workloadCellCount = summary.path("workloadCellCount").asInt(-1);
        List<SearchPerformanceEvidence.C21Cell> cells = new ArrayList<>();
        node.path("cells").forEach(cell -> {
            SearchPerformanceEvidence.LatencyInference apiElapsed =
                    inference(cell.path("batchLevelInference").path("apiElapsed").path("statistics"));
            if (apiElapsed == null) {
                throw new IllegalStateException("C2.1 workload cell is missing batch-level API inference");
            }
            cells.add(new SearchPerformanceEvidence.C21Cell(
                    cell.path("id").asText(),
                    c21Workload(cell),
                    cell.path("totalHits").asLong(),
                    apiElapsed));
        });
        if (workloadCellCount < 1 || cells.size() != workloadCellCount) {
            throw new IllegalStateException("C2.1 evidence workload summary does not match retained cells");
        }

        return new SearchPerformanceEvidence.C21AdversarialEvidence(
                node.path("capturedAt").asText(),
                node.path("openSearchTreatment").asText(),
                workloadCellCount,
                restartBlocks,
                independentBatches,
                apiSummary.path("solrLowerLatencyCells").asInt(),
                apiSummary.path("openSearchLowerLatencyCells").asInt(),
                apiSummary.path("tiedCells").asInt(),
                apiSummary.path("ciExcludesZeroFavoringSolr").asInt(),
                apiSummary.path("ciExcludesZeroFavoringOpenSearch").asInt(),
                cells,
                node.path("claimGuardrail").asText());
    }

    private static String c21Workload(JsonNode cell) {
        String query = cell.path("request").path("query").asText().trim();
        if (!query.isBlank()) {
            return query;
        }
        String selected = cell.path("selected").path("normalizedIdentity").asText().trim();
        if (!selected.isBlank()) {
            return selected;
        }
        String family = cell.path("family").asText().trim();
        return family.isBlank() ? cell.path("id").asText() : family;
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
