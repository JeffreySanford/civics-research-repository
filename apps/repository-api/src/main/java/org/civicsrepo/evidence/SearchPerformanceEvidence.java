package org.civicsrepo.evidence;

import java.util.List;

/** Stable API summary of the locally certified Solr/OpenSearch C2 research evidence. */
public record SearchPerformanceEvidence(
        String profile,
        String capturedAt,
        String scope,
        boolean comparativeClaimAllowed,
        String projectionId,
        long projectionObjectCount,
        long retainedFederatedRecords,
        boolean targetParity,
        String claimGuardrail,
        ExecutionControls executionControls,
        BatchInference standaloneBatchEvidence,
        OrderRobustness orderRobustness,
        List<PairedWorkload> pairedWorkloads,
        List<ConcurrencyCell> concurrency,
        ResourceSummary resources) {

    public SearchPerformanceEvidence {
        pairedWorkloads = List.copyOf(pairedWorkloads);
        concurrency = List.copyOf(concurrency);
    }

    public record ExecutionControls(
            String orderStrategy,
            String requestedStartingOrder,
            String realizedFirstBatchOrder,
            Long seed,
            boolean seedApplied,
            Integer batches,
            Integer measuredRunsPerBatch,
            Integer totalMeasuredRuns,
            List<String> batchExecutionOrders) {

        public ExecutionControls {
            batchExecutionOrders = List.copyOf(batchExecutionOrders);
        }
    }

    /** Positive differences mean OpenSearch took longer than Solr. */
    public record LatencyInference(
            Double medianDifferenceMs,
            Double lower95Ms,
            Double upper95Ms,
            Double solrWinRatePercent,
            Boolean excludesZero,
            String interpretation) {}

    public record BatchInference(
            boolean available,
            String scenario,
            String query,
            Integer batchCount,
            LatencyInference apiElapsed,
            LatencyInference engineReported,
            String experimentalUnit) {}

    public record OrderRobustness(
            int scenarioCount,
            int solrLeadsP50BothOrdersCount,
            int solrLeadsP95BothOrdersCount,
            List<OrderScenario> scenarios) {

        public OrderRobustness {
            scenarios = List.copyOf(scenarios);
        }
    }

    public record OrderScenario(
            String id,
            boolean solrLeadsP50BothOrders,
            boolean solrLeadsP95BothOrders) {}

    public record PairedWorkload(
            String scenario,
            String workloadClass,
            String executionOrder,
            Double solrApiP50Ms,
            Double solrApiP95Ms,
            Double openSearchApiP50Ms,
            Double openSearchApiP95Ms,
            Double solrNativeP50Ms,
            Double solrNativeP95Ms,
            Double openSearchNativeP50Ms,
            Double openSearchNativeP95Ms) {}

    public record ConcurrencyCell(
            String workloadId,
            String workloadClass,
            int concurrency,
            Integer measuredComparisons,
            Double comparisonRequestsPerSecond,
            Double solrApiP50Ms,
            Double solrApiP95Ms,
            Double openSearchApiP50Ms,
            Double openSearchApiP95Ms,
            LatencyInference requestLevel,
            BatchCellInference batchLevel) {}

    public record BatchCellInference(
            boolean available,
            Integer batchCount,
            LatencyInference apiElapsed) {}

    public record ResourceSummary(
            boolean captured,
            String interpretation,
            boolean counterResetDetected,
            List<String> counterResetFields) {

        public ResourceSummary {
            counterResetFields = List.copyOf(counterResetFields);
        }
    }
}
