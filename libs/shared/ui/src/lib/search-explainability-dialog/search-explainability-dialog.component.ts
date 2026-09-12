import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Input,
  ViewChild,
} from '@angular/core';

let nextDialogId = 0;

export interface SearchExplainabilityFilter {
  label: string;
}

export interface SearchExplainabilityRelevance {
  band: string;
  normalizedScore: number;
}

export interface SearchExplainabilityModel {
  engine: string;
  normalization: string;
  calibrated: boolean;
}

export interface SearchExplainabilityMatchEvidence {
  label: string;
  matchedTerms: readonly string[];
}

@Component({
  selector: 'lib-search-explainability-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './search-explainability-dialog.component.html',
  styleUrl: './search-explainability-dialog.component.scss',
})
export class SearchExplainabilityDialogComponent {
  @Input({ required: true }) resultTitle = '';
  @Input({ required: true }) query = '';
  @Input() rank: number | null = null;
  @Input() relevance: SearchExplainabilityRelevance | null | undefined = null;
  @Input() relevanceModel: SearchExplainabilityModel | null | undefined = null;
  @Input() matchEvidence:
    | readonly SearchExplainabilityMatchEvidence[]
    | null
    | undefined = [];
  @Input() activeFilters: readonly SearchExplainabilityFilter[] = [];

  @ViewChild('trigger')
  private readonly trigger?: ElementRef<HTMLButtonElement>;

  @ViewChild('dialog')
  private readonly dialog?: ElementRef<HTMLDialogElement>;

  @ViewChild('dialogHeading')
  private readonly dialogHeading?: ElementRef<HTMLElement>;

  protected readonly headingId = `search-explainability-heading-${nextDialogId++}`;

  protected openDialog(): void {
    const dialog = this.dialog?.nativeElement;
    if (!dialog || dialog.open) {
      return;
    }

    if (typeof dialog.showModal === 'function') {
      dialog.showModal();
    } else {
      dialog.setAttribute('open', '');
    }

    queueMicrotask(() => this.dialogHeading?.nativeElement.focus());
  }

  protected closeDialog(): void {
    const dialog = this.dialog?.nativeElement;
    if (!dialog) {
      return;
    }

    if (typeof dialog.close === 'function') {
      dialog.close();
    } else {
      dialog.removeAttribute('open');
      this.restoreTriggerFocus();
    }
  }

  protected restoreTriggerFocus(): void {
    queueMicrotask(() => this.trigger?.nativeElement.focus());
  }

  protected get accessibleName(): string {
    return `Why this result matched: ${this.resultTitle}`;
  }

  protected get bandLabel(): string {
    const band = this.relevance?.band ?? '';
    if (!band) {
      return '';
    }
    return `${band.charAt(0)}${band.slice(1).toLowerCase()}`;
  }

  protected get normalizedScoreLabel(): string {
    return this.relevance?.normalizedScore.toFixed(2) ?? '';
  }

  protected get evidenceItems(): readonly SearchExplainabilityMatchEvidence[] {
    return this.matchEvidence ?? [];
  }

  protected get filterItems(): readonly SearchExplainabilityFilter[] {
    return this.activeFilters.filter((filter) => filter.label.trim().length > 0);
  }
}
