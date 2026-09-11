import { NgModule } from '@angular/core';
import { SearchRankBadgeComponent } from './search-rank-badge/search-rank-badge.component';
import { SearchRelevanceBadgeComponent } from './search-relevance-badge/search-relevance-badge.component';

@NgModule({
  declarations: [SearchRankBadgeComponent, SearchRelevanceBadgeComponent],
  exports: [SearchRankBadgeComponent, SearchRelevanceBadgeComponent],
})
export class SearchBadgesModule {}
