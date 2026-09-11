import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import type {
  SearchRelevance,
  SearchRelevanceBand,
} from 'repository-api-client';

const LABELS: Record<SearchRelevanceBand, string> = {
  STRONG: 'Strong match',
  GOOD: 'Good match',
  MODERATE: 'Moderate match',
  WEAK: 'Weak match',
  LOW: 'Low match',
};

@Component({
  selector: 'civics-search-relevance-badge',
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './search-relevance-badge.component.html',
  styleUrl: './search-relevance-badge.component.scss',
})
export class SearchRelevanceBadgeComponent {
  @Input() relevance: SearchRelevance | null | undefined;

  protected label(band: SearchRelevanceBand): string {
    return LABELS[band];
  }

  protected accessibleLabel(relevance: SearchRelevance): string {
    return `${this.label(relevance.band)}. Query-relative search match strength.`;
  }
}
