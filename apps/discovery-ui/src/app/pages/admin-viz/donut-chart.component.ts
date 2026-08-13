import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import type { DonutSegment } from './admin-viz.utils';

@Component({
  selector: 'app-admin-donut-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <figure class="admin-viz-donut">
      <svg
        viewBox="0 0 120 120"
        class="admin-viz-donut__svg"
        role="img"
        [attr.aria-label]="caption()"
      >
        <circle cx="60" cy="60" r="42" class="admin-viz-donut__ring"></circle>
        @for (arc of arcs(); track arc.label) {
          <circle
            cx="60"
            cy="60"
            r="42"
            class="admin-viz-donut__segment"
            [attr.stroke]="arc.color"
            [attr.stroke-dasharray]="arc.dashArray"
            [attr.stroke-dashoffset]="arc.dashOffset"
          ></circle>
        }
        <text x="60" y="56" text-anchor="middle" class="admin-viz-donut__total">
          {{ total() }}
        </text>
        <text
          x="60"
          y="72"
          text-anchor="middle"
          class="admin-viz-donut__subtitle"
        >
          indexed
        </text>
      </svg>
      <ul class="admin-viz-donut__legend" aria-hidden="true">
        @for (segment of segments(); track segment.label) {
          <li>
            <span
              class="admin-viz-donut__swatch"
              [style.background]="segment.color"
            ></span>
            <span>{{ segment.label }}</span>
            <strong>{{ segment.value }}</strong>
          </li>
        }
      </ul>
      <figcaption class="visually-hidden">
        <table>
          <caption>
            {{
              caption()
            }}
          </caption>
          <thead>
            <tr>
              <th scope="col">Segment</th>
              <th scope="col">Count</th>
            </tr>
          </thead>
          <tbody>
            @for (segment of segments(); track segment.label) {
              <tr>
                <th scope="row">{{ segment.label }}</th>
                <td>{{ segment.value }}</td>
              </tr>
            }
          </tbody>
        </table>
      </figcaption>
    </figure>
  `,
  styleUrl: './admin-viz.scss',
})
export class AdminDonutChartComponent {
  readonly segments = input.required<readonly DonutSegment[]>();
  readonly caption = input('Donut chart');

  protected readonly total = computed(() =>
    this.segments().reduce((sum, segment) => sum + segment.value, 0),
  );

  protected readonly arcs = computed(() => {
    const circumference = 2 * Math.PI * 42;
    const total = Math.max(1, this.total());
    let offset = circumference * 0.25;

    return this.segments().map((segment) => {
      const length = (segment.value / total) * circumference;
      const dashArray = `${length} ${circumference - length}`;
      const dashOffset = -offset;
      offset += length;
      return {
        label: segment.label,
        color: segment.color,
        dashArray,
        dashOffset,
      };
    });
  });
}
