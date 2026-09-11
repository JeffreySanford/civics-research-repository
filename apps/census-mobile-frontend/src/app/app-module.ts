import { provideHttpClient } from '@angular/common/http';
import { NgModule, provideBrowserGlobalErrorListeners } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { RouterModule } from '@angular/router';
import { provideEffects } from '@ngrx/effects';
import { provideState, provideStore } from '@ngrx/store';
import { App } from './app';
import { appRoutes } from './app.routes';
import { SearchEffects } from './state/search/search.effects';
import { searchFeatureKey, searchReducer } from './state/search/search.reducer';

@NgModule({
  declarations: [App],
  imports: [BrowserModule, RouterModule.forRoot(appRoutes)],
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideHttpClient(),
    provideStore(
      {},
      {
        runtimeChecks: {
          strictStateImmutability: true,
          strictActionImmutability: true,
          strictStateSerializability: true,
          strictActionSerializability: true,
          strictActionWithinNgZone: false,
          strictActionTypeUniqueness: true,
        },
      },
    ),
    provideState(searchFeatureKey, searchReducer),
    provideEffects([SearchEffects]),
  ],
  bootstrap: [App],
})
export class AppModule {}
