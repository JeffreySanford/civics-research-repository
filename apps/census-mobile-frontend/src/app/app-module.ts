import { HttpClientModule } from '@angular/common/http';
import { NgModule, provideBrowserGlobalErrorListeners } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { RouterModule } from '@angular/router';
import { EffectsModule } from '@ngrx/effects';
import { StoreModule } from '@ngrx/store';
import { App } from './app';
import { appRoutes } from './app.routes';
import { MobileSearchEffects } from './state/search/search.effects';
import { mobileSearchReducer } from './state/search/search.reducer';

@NgModule({
  declarations: [App],
  imports: [
    BrowserModule,
    HttpClientModule,
    RouterModule.forRoot(appRoutes),
    StoreModule.forRoot({ mobileSearch: mobileSearchReducer }),
    EffectsModule.forRoot([MobileSearchEffects]),
  ],
  providers: [provideBrowserGlobalErrorListeners()],
  bootstrap: [App],
})
export class AppModule {}
