import { DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { ResearchCoverageSummary } from '../state/maps/research-coverage';

@Component({
  selector: 'app-research-coverage-summary',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, DecimalPipe],
  template: `
    <section
      class="research-coverage-summary"
      aria-labelledby="research-coverage-summary-heading"
    >
      <h3 id="research-coverage-summary-heading">
        Data.gov publisher research geometry
      </h3>

      @if (loading()) {
        <p class="feature-hint" role="status">
          Updating publisher spatial coverage for the current map viewport.
        </p>
      }

      @if (summary(); as researchCoverage) {
        <p>
          {{ researchCoverage.mappedResults | number }} of
          {{ researchCoverage.totalResults | number }} matching Data.gov
          research objects have publisher spatial geometry.
          {{ researchCoverage.unmappedResults | number }} have no publisher
          geometry and {{ researchCoverage.quarantinedResults | number }} have
          geometry that failed validation. The current viewport contains
          {{ researchCoverage.viewportMappedResults | number }} mapped objects;
          {{ researchCoverage.returnedFeatures | number }} bounded features are
          returned to the browser. Publisher, laboratory, author, and
          institution addresses are never substituted for missing research
          geometry.
        </p>

        @if (researchCoverage.unanchoredAntimeridianResults > 0) {
          <p class="feature-hint">
            {{ researchCoverage.unanchoredAntimeridianResults | number }}
            antimeridian candidate geometries lack a safe render anchor and are
            not mapped.
          </p>
        }

        @if (researchCoverage.truncated) {
          <p class="feature-hint">
            {{ researchCoverage.omittedFeatures | number }} additional mapped
            objects in this viewport are omitted by the
            {{ researchCoverage.featureLimit | number }}-feature browser safety
            limit. Pan or zoom to refine the bounded result.
          </p>
        }

        @if (researchCoverage.features.length) {
          <table class="county-value-table">
            <caption>
              Publisher-spatial research objects returned for the current map
              viewport
            </caption>
            <thead>
              <tr>
                <th scope="col">Research object</th>
                <th scope="col">Publisher</th>
                <th scope="col">Program / type</th>
                <th scope="col">Geometry</th>
                <th scope="col">Source</th>
              </tr>
            </thead>
            <tbody>
              @for (
                feature of researchCoverage.features;
                track feature.sourceIdentifier
              ) {
                <tr>
                  <th scope="row">{{ feature.title }}</th>
                  <td>{{ feature.publisher || 'Not stated' }}</td>
                  <td>
                    {{ feature.program || 'Not stated' }} /
                    {{ feature.contentType || 'Not stated' }}
                  </td>
                  <td>
                    @if (feature.geometryStatus === 'ANTIMERIDIAN_CANDIDATE') {
                      Source-derived render anchor for antimeridian candidate
                    } @else {
                      Publisher geometry
                    }
                  </td>
                  <td>
                    @if (feature.sourceUrl) {
                      <a
                        class="source-link"
                        [href]="feature.sourceUrl"
                        [attr.aria-label]="
                          'Open source record for ' + feature.title
                        "
                        >Open source record</a
                      >
                    } @else {
                      Data.gov source identifier {{ feature.sourceIdentifier }}
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        } @else {
          <p class="feature-hint">
            No publisher-spatial research objects from this search intersect the
            current viewport.
          </p>
        }

        <p class="feature-hint">
          Spatial build {{ researchCoverage.buildId }} · source snapshot
          {{ researchCoverage.sourceSnapshotAt | date: 'medium' }} · projection
          {{ researchCoverage.projectionId }}
        </p>
      } @else if (!loading()) {
        <p class="feature-hint">
          No bounded publisher-spatial response is available for the current
          viewport.
        </p>
      }
    </section>
  `,
})
export class ResearchCoverageSummaryComponent {
  readonly summary = input<ResearchCoverageSummary | null>(null);
  readonly loading = input(false);
}
