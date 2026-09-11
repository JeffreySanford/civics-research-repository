import { Route } from '@angular/router';
import { SearchPageComponent } from './pages/search-page/search-page.component';

export const appRoutes: Route[] = [
  {
    path: '',
    component: SearchPageComponent,
    title: 'Census Research',
  },
];
