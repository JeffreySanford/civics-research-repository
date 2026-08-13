import {
  ApplicationConfig,
  isDevMode,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { provideEffects } from '@ngrx/effects';
import { provideRouterStore } from '@ngrx/router-store';
import { provideState, provideStore } from '@ngrx/store';
import { provideStoreDevtools } from '@ngrx/store-devtools';
import { appRoutes } from './app.routes';
import { DatasetsEffects } from './state/datasets/datasets.effects';
import {
  datasetsFeatureKey,
  datasetsReducer,
} from './state/datasets/datasets.reducer';
import { ErrorNotificationEffects } from './state/error-notification/error-notification.effects';
import { MapsEffects } from './state/maps/maps.effects';
import { mapsFeatureKey, mapsReducer } from './state/maps/maps.reducer';
import { SearchEffects } from './state/search/search.effects';
import { searchFeatureKey, searchReducer } from './state/search/search.reducer';
import { SyncEffects } from './state/sync/sync.effects';
import { syncFeatureKey, syncReducer } from './state/sync/sync.reducer';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideAnimations(),
    provideHttpClient(),
    provideRouter(appRoutes),
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
    provideState(datasetsFeatureKey, datasetsReducer),
    provideState(mapsFeatureKey, mapsReducer),
    provideState(searchFeatureKey, searchReducer),
    provideState(syncFeatureKey, syncReducer),
    provideEffects([
      DatasetsEffects,
      ErrorNotificationEffects,
      MapsEffects,
      SearchEffects,
      SyncEffects,
    ]),
    provideRouterStore(),
    provideStoreDevtools({
      maxAge: 25,
      logOnly: !isDevMode(),
      connectInZone: true,
    }),
  ],
};
