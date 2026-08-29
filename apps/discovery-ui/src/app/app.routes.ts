import { Route } from '@angular/router';
import { HomePage } from './pages/home-page';

/**
 * Only the landing page is eager.
 *
 * Every other page was compiled into the initial bundle, which meant a visitor to `/` downloaded
 * the admin sync form's select, tabs, and form-field machinery before seeing anything. Lazy routes
 * cost one small fetch on first navigation and keep the initial payload to what the landing page
 * actually renders.
 */
export const appRoutes: Route[] = [
  { path: '', component: HomePage, title: 'Civics Research Repository' },
  {
    path: 'discovery',
    loadComponent: () =>
      import('./pages/discovery-page').then((m) => m.DiscoveryPage),
    title: 'Discovery',
  },
  {
    path: 'search-lab',
    loadComponent: () =>
      import('./pages/search-lab-page').then((m) => m.SearchLabPage),
    title: 'Search Engine Lab',
  },
  {
    path: 'datasets/:datasetId',
    loadComponent: () =>
      import('./pages/dataset-detail-page').then(
        (m) => m.ResearchObjectDetailPage,
      ),
    title: 'Dataset Detail',
  },
  {
    path: 'admin/sync',
    loadComponent: () =>
      import('./pages/admin-sync-page').then((m) => m.AdminSyncPage),
    title: 'Repository Sync',
  },
  {
    path: 'evidence',
    loadComponent: () =>
      import('./pages/evidence-page').then((m) => m.EvidencePage),
    title: 'Platform Evidence',
  },
  {
    path: 'maps',
    loadComponent: () => import('./pages/maps-page').then((m) => m.MapsPage),
    title: 'Map Preview',
  },
  { path: '**', redirectTo: '' },
];