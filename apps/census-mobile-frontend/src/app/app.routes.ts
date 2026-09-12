import type { Routes } from '@angular/router';
import { MobileResearchDetailComponent } from './components/mobile-research-detail/mobile-research-detail.component';

export const appRoutes: Routes = [
  { path: 'research/:researchId', component: MobileResearchDetailComponent },
];
