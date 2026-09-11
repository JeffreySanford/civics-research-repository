import { Component, computed, input, signal } from '@angular/core';
import type { FacetGroup, FacetValue } from 'repository-api-client';

@Component({
  selector: 'app-search-summary',
  standalone: false,
  templateUrl: './search-summary.component.html',
  styleUrl: './search-summary.component.scss',
})
export class SearchSummaryComponent {
  readonly facet = input<FacetGroup | null>(null);
  readonly totalResults = input(0);
  readonly expanded = signal(false);

  readonly values = computed(() =>
    [...(this.facet()?.values ?? [])]
      .filter((value) => value.count > 0)
      .sort(
        (left, right) =>
          right.count - left.count || left.label.localeCompare(right.label),
      ),
  );
  readonly visibleValues = computed(() =>
    this.expanded() ? this.values() : this.values().slice(0, 4),
  );
  readonly hasMore = computed(() => this.values().length > 4);

  toggleExpanded(): void {
    this.expanded.update((expanded) => !expanded);
  }

  percentage(value: FacetValue): number {
    const total = this.totalResults();
    return total > 0 ? Math.round((value.count / total) * 100) : 0;
  }
}
