import { Component, EventEmitter, Input, Output } from '@angular/core';
import type { FacetGroup, SearchQuery } from 'repository-api-client';
import type {
  MobileActiveFilter,
  MobileFilterField,
  MobileFilterSelection,
} from './mobile-search-filters.model';

@Component({
  selector: 'app-mobile-search-filters',
  standalone: false,
  templateUrl: './mobile-search-filters.component.html',
  styleUrl: './mobile-search-filters.component.scss',
})
export class MobileSearchFiltersComponent {
  @Input() facets: readonly FacetGroup[] = [];
  @Input() query: SearchQuery = { page: 0, pageSize: 10 };
  @Input() activeFilters: readonly MobileActiveFilter[] = [];

  @Output() readonly closeRequested = new EventEmitter<void>();
  @Output() readonly filterSelected = new EventEmitter<MobileFilterSelection>();
  @Output() readonly clearRequested = new EventEmitter<void>();

  close(): void {
    this.closeRequested.emit();
  }

  select(field: MobileFilterField, value: string): void {
    this.filterSelected.emit({ field, value });
  }

  clear(): void {
    this.clearRequested.emit();
  }

  isSupportedFacet(field: string): field is MobileFilterField {
    return [
      'program',
      'publisher',
      'sourceSystem',
      'geography',
      'type',
      'vintageYear',
    ].includes(field);
  }

  isFacetSelected(field: MobileFilterField, value: string): boolean {
    switch (field) {
      case 'program':
        return this.query.programs?.includes(value) ?? false;
      case 'publisher':
        return this.query.publisher === value;
      case 'sourceSystem':
        return this.query.sourceSystem === value;
      case 'geography':
        return this.query.geography === value;
      case 'type':
        return this.query.contentType === value;
      case 'vintageYear':
        return String(this.query.vintageYear ?? '') === value;
    }
  }
}
