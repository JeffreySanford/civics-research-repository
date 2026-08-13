import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { prefersReducedMotion } from './admin-viz.utils';

@Component({
  selector: 'app-animated-counter',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span
      class="admin-viz-counter"
      [class.admin-viz-counter--pulse]="pulse()"
      aria-hidden="true"
      >{{ displayValue() }}</span
    >
  `,
  styles: `
    .admin-viz-counter {
      font-variant-numeric: tabular-nums;
      font-weight: 800;
      color: var(--civics-text-primary);
    }

    .admin-viz-counter--pulse {
      animation: admin-counter-pulse 600ms ease-out;
    }

    @keyframes admin-counter-pulse {
      0% {
        color: var(--mat-sys-primary);
      }
      100% {
        color: var(--civics-text-primary);
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .admin-viz-counter--pulse {
        animation: none;
      }
    }
  `,
})
export class AnimatedCounterComponent {
  private readonly destroyRef = inject(DestroyRef);

  readonly value = input<number | null | undefined>(0);

  protected readonly displayValue = signal(0);
  protected readonly pulse = signal(false);

  private frameId: number | null = null;

  constructor() {
    effect(() => {
      const next = this.value() ?? 0;
      this.animateTo(next);
    });

    this.destroyRef.onDestroy(() => {
      if (this.frameId !== null) {
        cancelAnimationFrame(this.frameId);
      }
    });
  }

  private animateTo(target: number): void {
    if (this.frameId !== null) {
      cancelAnimationFrame(this.frameId);
      this.frameId = null;
    }

    if (prefersReducedMotion()) {
      this.displayValue.set(target);
      return;
    }

    const start = this.displayValue();
    if (start === target) {
      return;
    }

    const startedAt = performance.now();
    const duration = 450;

    this.pulse.set(true);
    window.setTimeout(() => this.pulse.set(false), 650);

    const tick = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / duration);
      const eased = 1 - (1 - progress) ** 3;
      this.displayValue.set(Math.round(start + (target - start) * eased));
      if (progress < 1) {
        this.frameId = requestAnimationFrame(tick);
      } else {
        this.frameId = null;
      }
    };

    this.frameId = requestAnimationFrame(tick);
  }
}
