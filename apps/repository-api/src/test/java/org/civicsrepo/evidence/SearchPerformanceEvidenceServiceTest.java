package org.civicsrepo.evidence;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class SearchPerformanceEvidenceServiceTest {
    private static final String PROJECTION = "a".repeat(64);

    @TempDir
    Path tempDir;

    @Test
    void mapsCertifiedResearchAndStatisticalArtifactsIntoStableEvidence() throws Exception {
        writeResearchReport(PROJECTION);
        writeStatisticalReport(PROJECTION);

        SearchPerformanceEvidence evidence = new SearchPerformanceEvidenceService(tempDir.toString())
                .latestEvidence()
                .orElseThrow();

        assertThat(evidence.profile()).isEqualTo("FEDERATED_1M");
        assertThat(evidence.projectionId()).isEqualTo(PROJECTION);
        assertThat(evidence.projectionObjectCount()).isEqualTo(1_000_181);
        assertThat(evidence.retainedFederatedRecords()).isEqualTo(1_000_000);
        assertThat(evidence.targetParity()).isTrue();
        assertThat(evidence.executionControls().orderStrategy()).isEqualTo("RANDOMIZED");
        assertThat(evidence.executionControls().batchExecutionOrders())
                .containsExactly("OPENSEARCH_FIRST", "SOLR_FIRST");
        assertThat(evidence.standaloneBatchEvidence().batchCount()).isEqualTo(6);
        assertThat(evidence.standaloneBatchEvidence().apiElapsed().medianDifferenceMs()).isEqualTo(4.0);
        assertThat(evidence.standaloneBatchEvidence().apiElapsed().excludesZero()).isTrue();
        assertThat(evidence.orderRobustness().solrLeadsP95BothOrdersCount()).isEqualTo(1);
        assertThat(evidence.pairedWorkloads()).hasSize(2);
        assertThat(evidence.pairedWorkloads().getFirst().solrApiP50Ms()).isEqualTo(5.0);
        assertThat(evidence.concurrency()).hasSize(1);
        assertThat(evidence.concurrency().getFirst().concurrency()).isEqualTo(8);
        assertThat(evidence.concurrency().getFirst().batchLevel().batchCount()).isEqualTo(6);
        assertThat(evidence.resources().captured()).isTrue();
        assertThat(evidence.resources().counterResetDetected()).isFalse();
    }

    @Test
    void returnsEmptyWhenGeneratedEvidenceIsNotAvailable() {
        assertThat(new SearchPerformanceEvidenceService(tempDir.toString()).latestEvidence()).isEmpty();
    }

    @Test
    void rejectsArtifactsFromDifferentProjections() throws Exception {
        writeResearchReport(PROJECTION);
        writeStatisticalReport("b".repeat(64));

        SearchPerformanceEvidenceService service = new SearchPerformanceEvidenceService(tempDir.toString());

        assertThatThrownBy(service::latestEvidence)
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("projection mismatch");
    }

    private void writeResearchReport(String projection) throws Exception {
        Path directory = tempDir.resolve("research-performance");
        Files.createDirectories(directory);
        Files.writeString(directory.resolve("federated-1m-report.json"), """
                {
                  "capturedAt": "2026-09-03T19:05:33.124Z",
                  "paired": {
                    "profile": "FEDERATED_1M",
                    "projection": {"projectionId": "%s", "objectCount": 1000181},
                    "evidence": {"retainedFederatedRecordCount": 1000000, "targetParity": true},
                    "passes": {
                      "SOLR_FIRST": {
                        "scenarios": [
                          {
                            "id": "FULL_TEXT_RELEVANCE",
                            "workloadClass": "FULL_TEXT",
                            "solr": {"elapsed": {"p50Ms": 5, "p95Ms": 5}, "engineReported": {"p50Ms": 3, "p95Ms": 3}},
                            "openSearch": {"elapsed": {"p50Ms": 7, "p95Ms": 11}, "engineReported": {"p50Ms": 5, "p95Ms": 8}}
                          }
                        ]
                      },
                      "OPENSEARCH_FIRST": {
                        "scenarios": [
                          {
                            "id": "FULL_TEXT_RELEVANCE",
                            "workloadClass": "FULL_TEXT",
                            "solr": {"elapsed": {"p50Ms": 2, "p95Ms": 2}, "engineReported": {"p50Ms": 1, "p95Ms": 1}},
                            "openSearch": {"elapsed": {"p50Ms": 5, "p95Ms": 6}, "engineReported": {"p50Ms": 4, "p95Ms": 5}}
                          }
                        ]
                      }
                    }
                  }
                }
                """.formatted(projection));
    }

    private void writeStatisticalReport(String projection) throws Exception {
        Files.writeString(tempDir.resolve("search-comparison-statistical-report.json"), """
                {
                  "capturedAt": "2026-09-03T19:06:00Z",
                  "scope": "LOCAL_CERTIFIED_TOPOLOGY_ONLY",
                  "comparativeClaimAllowed": false,
                  "projection": {"projectionId": "%s"},
                  "claimGuardrail": "Scoped C2 claims only.",
                  "executionControlEvidence": {
                    "orderStrategy": "RANDOMIZED",
                    "requestedStartingOrder": "SOLR_FIRST",
                    "realizedFirstBatchOrder": "OPENSEARCH_FIRST",
                    "seed": 20260903,
                    "seedApplied": true,
                    "batches": 6,
                    "measuredRunsPerBatch": 20,
                    "totalMeasuredRuns": 120,
                    "batchExecutionOrders": ["OPENSEARCH_FIRST", "SOLR_FIRST"]
                  },
                  "batchLevelEvidence": {
                    "available": true,
                    "workload": {"scenario": "FULL_TEXT_RELEVANCE", "query": "North Dakota workforce"},
                    "batchCount": 6,
                    "experimentalUnit": "One separately warmed benchmark batch.",
                    "apiElapsed": {"statistics": {
                      "interpretation": "Positive differences mean OpenSearch took longer than Solr.",
                      "medianDifferenceMs": 4,
                      "solrWinRatePercent": 100,
                      "bootstrap": {"lowerMs": 2, "upperMs": 5, "excludesZero": true}
                    }},
                    "engineReported": {"statistics": {
                      "medianDifferenceMs": 3,
                      "solrWinRatePercent": 100,
                      "bootstrap": {"lowerMs": 2, "upperMs": 4, "excludesZero": true}
                    }}
                  },
                  "orderRobustness": {
                    "scenarioCount": 1,
                    "solrLeadsP50BothOrdersCount": 1,
                    "solrLeadsP95BothOrdersCount": 1,
                    "scenarios": [{"id": "FULL_TEXT_RELEVANCE", "solrLeadsP50BothOrders": true, "solrLeadsP95BothOrders": true}]
                  },
                  "concurrencyEvidence": [
                    {
                      "workloadId": "FULL_TEXT_RELEVANCE",
                      "workloadClass": "FULL_TEXT",
                      "concurrency": 8,
                      "measuredComparisons": 240,
                      "comparisonRequestsPerSecond": 18.5,
                      "solrApiP50Ms": 8,
                      "solrApiP95Ms": 15,
                      "openSearchApiP50Ms": 14,
                      "openSearchApiP95Ms": 29,
                      "medianPairedDifferenceMs": 6,
                      "pairedBootstrap95PercentCiMs": [4, 8],
                      "solrWinRatePercent": 96.5
                    }
                  ],
                  "concurrencyBatchEvidence": [
                    {
                      "workloadId": "FULL_TEXT_RELEVANCE",
                      "workloadClass": "FULL_TEXT",
                      "concurrency": 8,
                      "available": true,
                      "batchCount": 6,
                      "apiElapsed": {"statistics": {
                        "medianDifferenceMs": 5,
                        "solrWinRatePercent": 100,
                        "bootstrap": {"lowerMs": 3, "upperMs": 7, "excludesZero": true}
                      }}
                    }
                  ],
                  "resourceEvidence": {
                    "interpretation": "Counter deltas and before/after observations are kept distinct.",
                    "counterResetDetected": false,
                    "counterResetFields": []
                  }
                }
                """.formatted(projection));
    }
}
