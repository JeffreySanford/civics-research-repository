import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { MobileResearchMapPreviewComponent } from './mobile-research-map-preview.component';

@NgModule({
  declarations: [MobileResearchMapPreviewComponent],
  imports: [CommonModule, RouterModule],
  exports: [MobileResearchMapPreviewComponent],
})
export class MobileResearchMapPreviewModule {}
