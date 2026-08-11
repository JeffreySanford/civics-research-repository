import { Route } from '@angular/router';
import { AdminSyncPage } from './pages/admin-sync-page';
import { DiscoveryPage } from './pages/discovery-page';
import { EvidencePage } from './pages/evidence-page';
import { HomePage } from './pages/home-page';
import { MapsPage } from './pages/maps-page';

export const appRoutes: Route[] = [
  { path: '', component: HomePage, title: 'Civics Research Repository' },
  { path: 'discovery', component: DiscoveryPage, title: 'Discovery' },
  {
    path: 'datasets/:datasetId',
    loadComponent: () =>
      import('./pages/dataset-detail-page').then((m) => m.DatasetDetailPage),
    title: 'Dataset Detail',
  },
  { path: 'admin/sync', component: AdminSyncPage, title: 'Repository Sync' },
  {
    path: 'evidence',
    component: EvidencePage,
    title: 'Accessibility Evidence',
  },
  { path: 'maps', component: MapsPage, title: 'Map Preview' },
  { path: '**', redirectTo: '' },
];
