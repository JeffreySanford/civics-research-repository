import { AsyncPipe, DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
} from '@angular/core';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Store } from '@ngrx/store';
import { PerformanceEvidenceActions } from '../state/performance-evidence/performance-evidence.actions';
import {
  selectPerformanceEvidence,
  selectPerformanceEvidenceError,
  selectPerformanceEvidenceLoading,
} from '../state/performance-evidence/performance-evidence.selectors';
import type { SearchPerformanceLatencyInference } from 'repository-api-client';

@Component({
  selector: 'app-search-performance-evidence',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AsyncPipe, DatePipe, MatProgressSpinnerModule],
  template: `
    <section
      class="content-panel"
      aria-labelledby="certified-search-performance-heading"
      data-testid="certified-search-performance"
    >
      <h2 id="certified-search-performance-heading">
        Certified C2 Solr / OpenSearch performance evidence
      </h2>
      <p>
        This panel reads the generated C2 research artifacts through the
        repository API. It separates descriptive request-level timing from the
        stronger separately warmed batch-level inference and retains the
        experiment controls that produced the evidence.
      </p>

      @if (loading$ | async) {
        <div class="inline-status" role="status">
          <mat-spinner
            diameter="24"
            aria-label="Loading certified search performance evidence"
          />
          <span>Loading certified search performance evidence</span>
        </div>
      }

      @if (error$ | async; as error) {
        <p class="warning-message" role="status">
          {{ error }} Run <code>pnpm run research:c2:evidence</code> on a
          certified local C2 corpus to generate it.
        </p>
      }

      @if (evidence$ | async; as evidence) {
        <dl class="pipeline-stats performance-evidence-summary">
          <div class="pipeline-stat">
            <dt>Certified corpus</dt>
            <dd class="pipeline-stat-value">
              {{ formatInteger(evidence.projectionObjectCount) }}
            </dd>
            <dd class="pipeline-stat-note">
              searchable objects;
              {{ formatInteger(evidence.retainedFederatedRecords) }} retained
              federated records. Target parity:
              {{ evidence.targetParity ? 'verified' : 'not verified' }}.
            </dd>
          </div>
          <div class="pipeline-stat">
            <dt>Projection</dt>
            <dd class="pipeline-stat-value performance-evidence-hash">
              {{ shortHash(evidence.projectionId) }}
            </dd>
            <dd class="pipeline-stat-note">
              {{ evidence.profile }} · captured
              {{ evidence.capturedAt | date: 'medium' }}
            </dd>
          </div>
          <div class="pipeline-stat">
            <dt>Order robustness</dt>
            <dd class="pipeline-stat-value">
              @if (evidence.orderRobustness; as robustness) {
                {{ robustness.solrLeadsP95BothOrdersCount }} /
                {{ robustness.scenarioCount }}
              } @else {
                n/a
              }
            </dd>
            <dd class="pipeline-stat-note">
              workload scenarios where Solr led API p95 in both engine-first
              orders.
            </dd>
          </div>
          <div class="pipeline-stat">
            <dt>Telemetry integrity</dt>
            <dd class="pipeline-stat-value">
              {{
                evidence.resources.counterResetDetected
                  ? 'Reset detected'
                  : 'No reset detected'
              }}
            </dd>
            <dd class="pipeline-stat-note">
              Resource counters and instantaneous observations remain distinct.
            </dd>
          </div>
        </dl>

        @if (evidence.standaloneBatchEvidence; as batch) {
          <section
            aria-labelledby="batch-inference-heading"
            class="evidence-subsection"
          >
            <h3 id="batch-inference-heading">
              Separately warmed batch inference
            </h3>
            <p>
              <strong>{{ batch.batchCount ?? 'n/a' }} batches</strong> ·
              {{ workloadLabel(batch.scenario) }}
              @if (batch.query) {
                · query <code>{{ batch.query }}</code>
              }
            </p>
            @if (batch.apiElapsed; as inference) {
              <dl class="evidence-metrics">
                <div>
                  <dt>Median paired difference</dt>
                  <dd>{{ formatLatency(inference.medianDifferenceMs) }}</dd>
                </div>
                <div>
                  <dt>Bootstrap 95% CI</dt>
                  <dd>{{ formatCi(inference) }}</dd>
                </div>
                <div>
                  <dt>Solr win rate</dt>
                  <dd>{{ formatPercent(inference.solrWinRatePercent) }}</dd>
                </div>
                <div>
                  <dt>Interval excludes zero</dt>
                  <dd>
                    {{
                      inference.excludesZero === null
                        ? 'n/a'
                        : inference.excludesZero
                          ? 'yes'
                          : 'no'
                    }}
                  </dd>
                </div>
              </dl>
              <p class="evidence-note">
                Positive differences mean OpenSearch took longer than Solr.
                Batch medians are the preferred repeated experimental unit for
                this standalone workload.
              </p>
            }
          </section>
        }

        <section
          aria-labelledby="paired-workloads-heading"
          class="evidence-subsection"
        >
          <h3 id="paired-workloads-heading">Paired workload latency</h3>
          <p>
            Application-boundary elapsed time, shown separately for both
            engine-first orders. These rows are descriptive request-level
            distributions; the order reversal tests whether the direction of the
            result survives execution order.
          </p>
          <div class="table-scroll">
            <table class="evidence-table">
              <caption>
                Solr and OpenSearch API latency by workload and engine-first
                execution order
              </caption>
              <thead>
                <tr>
                  <th scope="col">Workload</th>
                  <th scope="col">Order</th>
                  <th scope="col">Solr p50 / p95</th>
                  <th scope="col">OpenSearch p50 / p95</th>
                  <th scope="col">Solr native p50 / p95</th>
                  <th scope="col">OpenSearch native p50 / p95</th>
                </tr>
              </thead>
              <tbody>
                @for (
                  row of evidence.pairedWorkloads;
                  track row.scenario + row.executionOrder
                ) {
                  <tr>
                    <th scope="row">
                      {{ workloadLabel(row.workloadClass ?? row.scenario) }}
                    </th>
                    <td>{{ orderLabel(row.executionOrder) }}</td>
                    <td>
                      {{ latencyPair(row.solrApiP50Ms, row.solrApiP95Ms) }}
                    </td>
                    <td>
                      {{
                        latencyPair(
                          row.openSearchApiP50Ms,
                          row.openSearchApiP95Ms
                        )
                      }}
                    </td>
                    <td>
                      {{
                        latencyPair(row.solrNativeP50Ms, row.solrNativeP95Ms)
                      }}
                    </td>
                    <td>
                      {{
                        latencyPair(
                          row.openSearchNativeP50Ms,
                          row.openSearchNativeP95Ms
                        )
                      }}
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </section>

        @if (evidence.concurrency.length > 0) {
          <section
            aria-labelledby="concurrency-evidence-heading"
            class="evidence-subsection"
          >
            <h3 id="concurrency-evidence-heading">
              Concurrency matrix: 1 / 8 / 32 clients
            </h3>
            <p>
              This is the paired application comparison topology, not an
              isolated search-engine saturation test. Each cell retains request
              throughput, per-engine latency, and the independent-batch
              confidence interval where available.
            </p>
            <div class="table-scroll">
              <table class="evidence-table">
                <caption>
                  C2 latency and confidence evidence by workload and client
                  concurrency
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Workload</th>
                    <th scope="col">Clients</th>
                    <th scope="col">Paired req/s</th>
                    <th scope="col">Solr p50 / p95</th>
                    <th scope="col">OpenSearch p50 / p95</th>
                    <th scope="col">Request median OS − Solr</th>
                    <th scope="col">Batch median OS − Solr (95% CI)</th>
                  </tr>
                </thead>
                <tbody>
                  @for (
                    row of evidence.concurrency;
                    track row.workloadId + '-' + row.concurrency
                  ) {
                    <tr>
                      <th scope="row">
                        {{ workloadLabel(row.workloadClass ?? row.workloadId) }}
                      </th>
                      <td>{{ row.concurrency }}</td>
                      <td>{{ formatRate(row.comparisonRequestsPerSecond) }}</td>
                      <td>
                        {{ latencyPair(row.solrApiP50Ms, row.solrApiP95Ms) }}
                      </td>
                      <td>
                        {{
                          latencyPair(
                            row.openSearchApiP50Ms,
                            row.openSearchApiP95Ms
                          )
                        }}
                      </td>
                      <td>
                        {{
                          formatLatency(
                            row.requestLevel?.medianDifferenceMs ?? null
                          )
                        }}
                        @if (row.requestLevel) {
                          <span class="table-secondary"
                            >{{
                              formatPercent(row.requestLevel.solrWinRatePercent)
                            }}
                            wins</span
                          >
                        }
                      </td>
                      <td>
                        @if (
                          row.batchLevel?.available &&
                            row.batchLevel.apiElapsed;
                          as batchInference
                        ) {
                          {{ formatLatency(batchInference.medianDifferenceMs) }}
                          <span class="table-secondary"
                            >CI {{ formatCi(batchInference) }}</span
                          >
                        } @else {
                          n/a
                        }
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </section>
        }

        @if (evidence.executionControls; as controls) {
          <section
            aria-labelledby="execution-controls-heading"
            class="evidence-subsection"
          >
            <h3 id="execution-controls-heading">Experimental controls</h3>
            <ul class="gap-list">
              <li>
                <strong>Order strategy</strong
                ><span>{{ controls.orderStrategy ?? 'n/a' }}</span>
              </li>
              <li>
                <strong>Requested starting order</strong
                ><span>{{ orderLabel(controls.requestedStartingOrder) }}</span>
              </li>
              <li>
                <strong>Realized first batch</strong
                ><span>{{ orderLabel(controls.realizedFirstBatchOrder) }}</span>
              </li>
              <li>
                <strong>Seed</strong
                ><span>{{
                  controls.seedApplied ? controls.seed : 'not applied'
                }}</span>
              </li>
              <li>
                <strong>Measured design</strong
                ><span
                  >{{ controls.batches ?? 'n/a' }} batches ×
                  {{ controls.measuredRunsPerBatch ?? 'n/a' }} measured
                  runs</span
                >
              </li>
            </ul>
          </section>
        }

        <p class="warning-message">
          <strong>Claim boundary:</strong> {{ evidence.claimGuardrail }}
        </p>
      }
    </section>
  `,
})
export class SearchPerformanceEvidenceComponent implements OnInit {
  private readonly store = inject(Store);

  protected readonly evidence$ = this.store.select(selectPerformanceEvidence);
  protected readonly loading$ = this.store.select(
    selectPerformanceEvidenceLoading,
  );
  protected readonly error$ = this.store.select(selectPerformanceEvidenceError);

  ngOnInit(): void {
    this.store.dispatch(PerformanceEvidenceActions.loadRequested());
  }

  protected formatInteger(value: number): string {
    return value.toLocaleString('en-US');
  }

  protected shortHash(value: string): string {
    return value.length > 16
      ? `${value.slice(0, 12)}…${value.slice(-6)}`
      : value;
  }

  protected formatLatency(value: number | null): string {
    return value === null ? 'n/a' : `${this.round(value)} ms`;
  }

  protected latencyPair(p50: number | null, p95: number | null): string {
    return `${this.formatLatency(p50)} / ${this.formatLatency(p95)}`;
  }

  protected formatCi(inference: SearchPerformanceLatencyInference): string {
    if (inference.lower95Ms === null || inference.upper95Ms === null) {
      return 'n/a';
    }
    return `${this.round(inference.lower95Ms)} .. ${this.round(inference.upper95Ms)} ms`;
  }

  protected formatPercent(value: number | null): string {
    return value === null ? 'n/a' : `${this.round(value)}%`;
  }

  protected formatRate(value: number | null): string {
    return value === null ? 'n/a' : this.round(value).toString();
  }

  protected workloadLabel(value: string | null): string {
    if (!value) {
      return 'Unspecified';
    }
    return value
      .toLowerCase()
      .split('_')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }

  protected orderLabel(value: string | null): string {
    if (!value) {
      return 'n/a';
    }
    return value === 'SOLR_FIRST'
      ? 'Solr first'
      : value === 'OPENSEARCH_FIRST'
        ? 'OpenSearch first'
        : value;
  }

  private round(value: number): number {
    return Math.round(value * 100) / 100;
  }
}
