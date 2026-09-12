import { A11yModule } from '@angular/cdk/a11y';
import { HttpClientModule } from '@angular/common/http';
import { NgModule, provideBrowserGlobalErrorListeners } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { RouterModule } from '@angular/router';
import { EffectsModule } from '@ngrx/effects';
import { StoreModule } from '@ngrx/store';
import { SearchBadgesModule } from 'shared-ui';
import { App } from './app';
import { appRoutes } from './app.routes';
import { MobileSearchFiltersComponent } from './components/mobile-search-filters/mobile-search-filters.component';
import { MobileResearchDetailComponent } from './components/mobile-research-detail/mobile-research-detail.component';
import { SearchSummaryComponent } from './components/search-summary/search-summary.component';
import { MobileResearchDetailEffects } from './state/research-detail/research-detail.effects';
import { mobileResearchDetailReducer } from './state/research-detail/research-detail.reducer';
import { MobileSearchEffects } from './state/search/search.effects';
import { mobileSearchReducer } from './state/search/search.reducer';

@NgModule({
  declarations: [
    App,
    MobileSearchFiltersComponent,
    MobileResearchDetailComponent,
    SearchSummaryComponent,
  ],
  imports: [
    BrowserModule,
    HttpClientModule,
    A11yModule,
    SearchBadgesModule,
    RouterModule.forRoot(appRoutes),
    StoreModule.forRoot({
      mobileSearch: mobileSearchReducer,
      researchDetail: mobileResearchDetailReducer,
    }),
    EffectsModule.forRoot([MobileSearchEffects, MobileResearchDetailEffects]),
  ],
  providers: [provideBrowserGlobalErrorListeners()],
  bootstrap: [App],
})
export class AppModule {}
