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
import { SearchMatchEvidenceComponent } from './components/search-match-evidence/search-match-evidence.component';
import { SearchSummaryComponent } from './components/search-summary/search-summary.component';
import { MobileSearchEffects } from './state/search/search.effects';
import { mobileSearchReducer } from './state/search/search.reducer';

@NgModule({
  declarations: [
    App,
    MobileSearchFiltersComponent,
    SearchMatchEvidenceComponent,
    SearchSummaryComponent,
  ],
  imports: [
    BrowserModule,
    HttpClientModule,
    A11yModule,
    SearchBadgesModule,
    RouterModule.forRoot(appRoutes),
    StoreModule.forRoot({ mobileSearch: mobileSearchReducer }),
    EffectsModule.forRoot([MobileSearchEffects]),
  ],
  providers: [provideBrowserGlobalErrorListeners()],
  bootstrap: [App],
})
export class AppModule {}
