import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

@Component({
  selector: 'civics-search-rank-badge',
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './search-rank-badge.component.html',
  styleUrl: './search-rank-badge.component.scss',
})
export class SearchRankBadgeComponent {
  @Input({ required: true }) rank = 0;

  protected get topRanked(): boolean {
    return this.rank > 0 && this.rank <= 3;
  }

  protected get accessibleLabel(): string {
    return this.topRanked
      ? `Top ranked. Rank ${this.rank} in this search.`
      : `Rank ${this.rank} in this search.`;
  }
}
