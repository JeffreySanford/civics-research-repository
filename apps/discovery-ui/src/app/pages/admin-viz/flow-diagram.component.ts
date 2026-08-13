import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { AnimatedCounterComponent } from './animated-counter.component';
import { adminFlowStepEnter } from './admin-viz.animations';
import type { FlowStep } from './admin-viz.utils';

@Component({
  selector: 'app-admin-flow-diagram',
  changeDetection: ChangeDetectionStrategy.OnPush,
  animations: [adminFlowStepEnter],
  imports: [AnimatedCounterComponent],
  template: `
    <figure class="admin-viz-flow">
      <ol class="admin-viz-flow__steps" aria-hidden="true">
        @for (step of steps(); track step.label; let last = $last) {
          <li class="admin-viz-flow__step" @adminFlowStepEnter>
            <div class="admin-viz-flow__node admin-viz-card">
              <span class="admin-viz-flow__label">{{ step.label }}</span>
              @if (step.count !== null && step.count !== undefined) {
                <app-animated-counter [value]="step.count" />
              }
              <p>{{ step.detail }}</p>
            </div>
            @if (!last) {
              <span class="admin-viz-flow__arrow" aria-hidden="true">→</span>
            }
          </li>
        }
      </ol>
      <figcaption class="visually-hidden">
        <table>
          <caption>
            {{
              caption()
            }}
          </caption>
          <thead>
            <tr>
              <th scope="col">Stage</th>
              <th scope="col">Count</th>
              <th scope="col">Description</th>
            </tr>
          </thead>
          <tbody>
            @for (step of steps(); track step.label) {
              <tr>
                <th scope="row">{{ step.label }}</th>
                <td>{{ step.count ?? 'n/a' }}</td>
                <td>{{ step.detail }}</td>
              </tr>
            }
          </tbody>
        </table>
      </figcaption>
    </figure>
  `,
  styleUrl: './admin-viz.scss',
})
export class AdminFlowDiagramComponent {
  readonly steps = input.required<readonly FlowStep[]>();
  readonly caption = input('Flow diagram');
}
