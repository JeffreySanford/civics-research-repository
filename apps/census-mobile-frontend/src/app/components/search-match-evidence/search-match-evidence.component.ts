import { Component, computed, input } from '@angular/core';
import type { SearchMatchEvidence } from 'repository-api-client';

@Component({
  selector: 'app-search-match-evidence',
  standalone: false,
  templateUrl: './search-match-evidence.component.html',
  styleUrl: './search-match-evidence.component.scss',
})
export class SearchMatchEvidenceComponent {
  readonly evidence = input<readonly SearchMatchEvidence[] | null | undefined>(
    null,
  );
  readonly items = computed(() => this.evidence() ?? []);
}
