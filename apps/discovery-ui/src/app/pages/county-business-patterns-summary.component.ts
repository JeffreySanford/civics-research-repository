import { DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { CountyBusinessPatternsChoropleth } from 'repository-api-client';

@Component({
  selector: 'app-county-business-patterns-summary',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, DecimalPipe],
  template: `
    <section
      class="county-business-patterns-summary"
      aria-labelledby="county-business-patterns-summary-heading"
    >
      <h3 id="county-business-patterns-summary-heading">
        County business activity
      </h3>

      @if (loading()) {
        <p class="feature-hint" role="status">
          Updating County Business Patterns for the selected measure and
          industry.
        </p>
      }

      @if (error(); as message) {
        <p class="warning-message" role="alert">
          County business activity unavailable: {{ message }}
        </p>
      } @else if (choropleth(); as cbp) {
        <p
          class="feature-announcement"
          role="status"
          aria-live="polite"
          aria-label="County business activity context"
        >
          Showing {{ cbp.measureLabel }} for {{ cbp.industryLabel }} in
          {{ cbp.geography }}, {{ cbp.year }}.
        </p>

        <p>
          {{ cbp.source }} reference-year {{ cbp.sourceReferenceYear }} values
          joined by county GEOID to authoritative Census county geometry,
          Vintage {{ cbp.geometryVintage }}.
        </p>

        <p class="feature-hint">
          {{ cbp.availableCountyCount }} counties have a published value for
          this industry; {{ cbp.unavailableCountyCount }} are unavailable.
          {{ cbp.missingRowSemantics }}
        </p>

        <p class="feature-hint">
          Census noise flags apply to employment and payroll values: G means
          less than 2% noise, H means 2% to less than 5%, and J means at least
          5%. They are not confidence intervals. Establishment counts do not use
          these flags.
        </p>

        <p>
          <a class="source-link" [href]="cbp.sourceUrl">
            Open Census County Business Patterns source
          </a>
          ·
          <a class="source-link" [href]="cbp.geometrySourceUrl">
            Open Census county geometry source
          </a>
        </p>

        <p class="feature-hint">
          Source captured {{ cbp.capturedAt | date: 'mediumDate' }} · reference
          year {{ cbp.sourceReferenceYear }} · geometry Vintage
          {{ cbp.geometryVintage }} · {{ cbp.excludedStatewideRows }} non-county
          aggregate source rows excluded from county-map data
        </p>

        @if (cbp.counties.length) {
          <table class="county-value-table">
            <caption>
              {{
                cbp.measureLabel
              }}
              for
              {{
                cbp.industryLabel
              }}
              in
              {{
                cbp.geography
              }},
              {{
                cbp.year
              }}
              ({{
                cbp.units
              }})
            </caption>

            <thead>
              <tr>
                <th scope="col">County</th>
                <th scope="col">FIPS</th>
                <th scope="col">{{ cbp.measureLabel }}</th>
                <th scope="col">Publication status</th>
                <th scope="col">Noise flag</th>
              </tr>
            </thead>

            <tbody>
              @for (county of cbp.counties; track county.fips) {
                <tr>
                  <th scope="row">{{ county.name }}</th>
                  <td>{{ county.fips }}</td>
                  <td>
                    @if (county.available && county.value !== null) {
                      {{ county.value | number: '1.0-0' }}
                      {{ cbp.units }}
                    } @else {
                      Unavailable
                    }
                  </td>
                  <td>{{ county.available ? 'Published' : 'Unavailable' }}</td>
                  <td>{{ county.noiseFlag ?? '—' }}</td>
                </tr>
              }
            </tbody>
          </table>
        } @else {
          <p class="feature-hint">
            No county geometry is available for this County Business Patterns
            view.
          </p>
        }
      } @else if (!loading()) {
        <p class="feature-hint">
          No County Business Patterns response is available for the selected
          area.
        </p>
      }
    </section>
  `,
})
export class CountyBusinessPatternsSummaryComponent {
  readonly choropleth = input<CountyBusinessPatternsChoropleth | null>(null);
  readonly loading = input(false);
  readonly error = input<string | null>(null);
}
