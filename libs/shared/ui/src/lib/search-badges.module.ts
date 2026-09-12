import { NgModule } from '@angular/core';
import { SearchExplainabilityDialogComponent } from './search-explainability-dialog/search-explainability-dialog.component';
import { SearchRankBadgeComponent } from './search-rank-badge/search-rank-badge.component';
import { SearchRelevanceBadgeComponent } from './search-relevance-badge/search-relevance-badge.component';

@NgModule({
  imports: [
    SearchRankBadgeComponent,
    SearchRelevanceBadgeComponent,
    SearchExplainabilityDialogComponent,
  ],
  exports: [
    SearchRankBadgeComponent,
    SearchRelevanceBadgeComponent,
    SearchExplainabilityDialogComponent,
  ],
})
export class SearchBadgesModule {}
