import { DatePipe, DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import type { PopulationEstimatesChoropleth } from 'repository-api-client';

@Component({
  selector: 'app-population-estimates-summary',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, DecimalPipe],
  template: `
    <section
      class="population-estimates-summary"
      aria-labelledby="population-estimates-summary-heading"
    >
      <h3 id="population-estimates-summary-heading">County population</h3>

      @if (loading()) {
        <p class="feature-hint" role="status">
          Updating County population for the selected measure and year.
        </p>
      }

      @if (error(); as message) {
        <p class="warning-message" role="alert">
          County population unavailable: {{ message }}
        </p>
      } @else if (choropleth(); as population) {
        <p
          class="feature-announcement"
          role="status"
          aria-live="polite"
          aria-label="County population context"
        >
          Showing {{ population.measureLabel }} for {{ population.geography }},
          {{ yearContext() }}.
        </p>

        <p>
          {{ population.source }} Vintage {{ population.sourceVintage }} values
          joined by county GEOID to authoritative Census county geometry,
          Vintage {{ population.geometryVintage }}.
        </p>

        <p class="feature-hint">
          Map color encodes {{ population.measureLabel.toLowerCase() }} in
          {{ population.units }}. Color communicates magnitude and direction
          only; it does not imply statistical significance.
        </p>

        <p>
          <a class="source-link" [href]="population.sourceUrl">
            Open Census Population Estimates source
          </a>
          ·
          <a class="source-link" [href]="population.geometrySourceUrl">
            Open Census county geometry source
          </a>
        </p>

        <p class="feature-hint">
          Source captured {{ population.capturedAt | date: 'mediumDate' }} ·
          value Vintage {{ population.sourceVintage }} · geometry Vintage
          {{ population.geometryVintage }}
        </p>

        @if (population.counties.length) {
          <table class="county-value-table">
            <caption>
              {{
                population.measureLabel
              }}
              for
              {{
                population.geography
              }},
              {{
                yearContext()
              }}
              ({{
                population.units
              }})
            </caption>

            <thead>
              <tr>
                <th scope="col">County</th>
                <th scope="col">FIPS</th>
                <th scope="col">{{ population.measureLabel }}</th>
                <th scope="col">Population</th>
                @if (population.priorYear) {
                  <th scope="col">{{ population.priorYear }} population</th>
                }
              </tr>
            </thead>

            <tbody>
              @for (county of population.counties; track county.fips) {
                <tr>
                  <th scope="row">{{ county.name }}</th>
                  <td>{{ county.fips }}</td>
                  <td>
                    {{ county.value | number: valueDigits() }}
                    @if (population.units === 'percent') {
                      %
                    } @else {
                      {{ ' ' + population.units }}
                    }
                  </td>
                  <td>{{ county.population | number: '1.0-0' }}</td>

                  @if (population.priorYear) {
                    <td>
                      @if (
                        county.priorPopulation !== null &&
                        county.priorPopulation !== undefined
                      ) {
                        {{ county.priorPopulation | number: '1.0-0' }}
                      } @else {
                        —
                      }
                    </td>
                  }
                </tr>
              }
            </tbody>
          </table>
        } @else {
          <p class="feature-hint">
            No county values are available for this Population Estimates view.
          </p>
        }
      } @else if (!loading()) {
        <p class="feature-hint">
          No County population response is available for the selected area.
        </p>
      }
    </section>
  `,
})
export class PopulationEstimatesSummaryComponent {
  readonly choropleth = input<PopulationEstimatesChoropleth | null>(null);
  readonly loading = input(false);
  readonly error = input<string | null>(null);

  protected readonly yearContext = computed(() => {
    const population = this.choropleth();

    if (!population) {
      return '';
    }

    return population.priorYear
      ? `${population.priorYear}–${population.year}`
      : String(population.year);
  });

  protected readonly valueDigits = computed(() =>
    this.choropleth()?.measure === 'ANNUAL_GROWTH_RATE' ? '1.0-2' : '1.0-0',
  );
}
