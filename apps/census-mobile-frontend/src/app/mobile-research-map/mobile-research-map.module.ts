import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { MobileResearchMapPageComponent } from './mobile-research-map-page.component';
import { MobileResearchMapPreviewModule } from './mobile-research-map-preview.module';

@NgModule({
  declarations: [MobileResearchMapPageComponent],
  imports: [
    CommonModule,
    MobileResearchMapPreviewModule,
    RouterModule.forChild([
      { path: '', component: MobileResearchMapPageComponent },
    ]),
  ],
})
export class MobileResearchMapModule {}
