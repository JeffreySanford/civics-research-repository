import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import type { BarChartItem } from './admin-viz.utils';

@Component({
  selector: 'app-admin-bar-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <figure class="admin-viz-bar-chart">
      <div class="admin-viz-bar-chart__bars" role="list" aria-hidden="true">
        @for (item of scaledItems(); track item.label) {
          <div class="admin-viz-bar-chart__row" role="listitem">
            <span class="admin-viz-bar-chart__label">{{ item.label }}</span>
            <div class="admin-viz-bar-chart__track">
              <div
                class="admin-viz-bar-chart__fill"
                [style.width.%]="item.percent"
              ></div>
            </div>
            <span class="admin-viz-bar-chart__value">{{ item.value }}</span>
          </div>
        }
      </div>
      <figcaption class="visually-hidden">
        <table>
          <caption>
            {{
              caption()
            }}
          </caption>
          <thead>
            <tr>
              <th scope="col">Label</th>
              <th scope="col">Count</th>
            </tr>
          </thead>
          <tbody>
            @for (item of items(); track item.label) {
              <tr>
                <th scope="row">{{ item.label }}</th>
                <td>{{ item.value }}</td>
              </tr>
            }
          </tbody>
        </table>
      </figcaption>
    </figure>
  `,
  styleUrl: './admin-viz.scss',
})
export class AdminBarChartComponent {
  readonly items = input.required<readonly BarChartItem[]>();
  readonly caption = input('Bar chart');

  protected readonly scaledItems = computed(() => {
    const items = this.items();
    const max = Math.max(1, ...items.map((item) => item.value));
    return items.map((item) => ({
      ...item,
      percent: Math.round((item.value / max) * 100),
    }));
  });
}
