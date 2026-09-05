import { DatePipe, DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';
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
      <h3 id="research-coverage-summary-heading">Data.gov research extents</h3>

      @if (loading()) {
        <p class="feature-hint" role="status">
          Updating Data.gov research extents for the current map viewport.
        </p>
      }

      @if (summary(); as researchCoverage) {
        <p>
          {{ researchCoverage.mappedResults | number }} of
          {{ researchCoverage.totalResults | number }} matching Data.gov
          research objects have publisher-declared spatial geometry.
          {{ researchCoverage.unmappedResults | number }} have no publisher
          geometry and {{ researchCoverage.quarantinedResults | number }} have
          geometry that failed validation. The current viewport contains
          {{ researchCoverage.viewportMappedResults | number }} mapped objects;
          {{ researchCoverage.returnedFeatures | number }} bounded features are
          returned to the browser.
        </p>

        <p class="feature-hint">
          Map points are deterministic display anchors for declared research
          extents. They are not observation sites or data-collection locations.
          Select a research object to reveal its publisher-declared footprint
          when it is safe to draw. Publisher, laboratory, author, and
          institution addresses are never substituted for missing research
          geometry.
        </p>

        <p
          class="feature-announcement"
          role="status"
          aria-label="Research extent selection"
        >
          @if (selectedFeature(); as selected) {
            Selected {{ selected.title }}. Its publisher-declared spatial
            geometry is highlighted when safe to draw.
          } @else {
            No research extent selected.
          }
        </p>

        @if (selectedFeature()) {
          <button
            type="button"
            class="feature-clear"
            (click)="selectionCleared.emit()"
          >
            Clear research extent selection
          </button>
        }

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
              Data.gov research extents returned for the current map viewport
            </caption>

            <thead>
              <tr>
                <th scope="col">Research object</th>
                <th scope="col">Publisher</th>
                <th scope="col">Program / type</th>
                <th scope="col">Map meaning</th>
                <th scope="col">Source</th>
              </tr>
            </thead>

            <tbody>
              @for (
                feature of researchCoverage.features;
                track feature.sourceIdentifier
              ) {
                <tr
                  [class.selected]="
                    selectedSourceIdentifier() === feature.sourceIdentifier
                  "
                >
                  <th scope="row">
                    <button
                      type="button"
                      class="flow-select"
                      [id]="featureButtonId(feature.sourceIdentifier)"
                      [attr.aria-pressed]="
                        selectedSourceIdentifier() === feature.sourceIdentifier
                      "
                      (click)="featureSelected.emit(feature.sourceIdentifier)"
                    >
                      {{ feature.title }}
                    </button>
                  </th>

                  <td>{{ feature.publisher || 'Not stated' }}</td>

                  <td>
                    {{ feature.program || 'Not stated' }} /
                    {{ feature.contentType || 'Not stated' }}
                  </td>

                  <td>
                    @if (feature.geometryStatus === 'ANTIMERIDIAN_CANDIDATE') {
                      Source-derived display anchor for antimeridian candidate
                    } @else if (
                      selectedSourceIdentifier() === feature.sourceIdentifier
                    ) {
                      Publisher-declared spatial geometry selected on map
                    } @else {
                      Display anchor for publisher-declared extent
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
            No Data.gov research extents from this search intersect the current
            viewport.
          </p>
        }

        <p class="feature-hint">
          Spatial build {{ researchCoverage.buildId }} · source snapshot
          {{ researchCoverage.sourceSnapshotAt | date: 'medium' }} · projection
          {{ researchCoverage.projectionId }}
        </p>
      } @else if (!loading()) {
        <p class="feature-hint">
          No bounded Data.gov research-extent response is available for the
          current viewport.
        </p>
      }
    </section>
  `,
})
export class ResearchCoverageSummaryComponent {
  readonly summary = input<ResearchCoverageSummary | null>(null);
  readonly loading = input(false);
  readonly selectedSourceIdentifier = input<string | null>(null);

  readonly featureSelected = output<string>();
  readonly selectionCleared = output<void>();

  protected readonly selectedFeature = computed(() => {
    const selectedId = this.selectedSourceIdentifier();

    if (!selectedId) {
      return null;
    }

    return (
      this.summary()?.features.find(
        (feature) => feature.sourceIdentifier === selectedId,
      ) ?? null
    );
  });

  protected featureButtonId(sourceIdentifier: string): string {
    return `research-coverage-feature-${sourceIdentifier}`;
  }
}
