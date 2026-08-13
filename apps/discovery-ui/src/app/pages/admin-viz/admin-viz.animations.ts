import {
  animate,
  query,
  stagger,
  style,
  transition,
  trigger,
} from '@angular/animations';

const enterDuration = '280ms';
const enterEase = 'cubic-bezier(0.22, 1, 0.36, 1)';

export const adminPanelEnter = trigger('adminPanelEnter', [
  transition(':enter', [
    style({ opacity: 0, transform: 'translateY(10px)' }),
    animate(
      `${enterDuration} ${enterEase}`,
      style({ opacity: 1, transform: 'none' }),
    ),
  ]),
]);

export const adminCardStagger = trigger('adminCardStagger', [
  transition(':enter', [
    query(
      '.admin-viz-card',
      [
        style({ opacity: 0, transform: 'translateY(8px)' }),
        stagger('60ms', [
          animate(
            `${enterDuration} ${enterEase}`,
            style({ opacity: 1, transform: 'none' }),
          ),
        ]),
      ],
      { optional: true },
    ),
  ]),
]);

export const adminFlowStepEnter = trigger('adminFlowStepEnter', [
  transition(':enter', [
    style({ opacity: 0, transform: 'translateX(-8px)' }),
    animate(
      `${enterDuration} ${enterEase}`,
      style({ opacity: 1, transform: 'none' }),
    ),
  ]),
]);
