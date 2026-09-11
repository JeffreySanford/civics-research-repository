from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise RuntimeError(f"Missing anchor for {label}")
    return text.replace(old, new, 1)


component_dir = Path("apps/census-mobile-frontend/src/app/components/search-summary")
component_dir.mkdir(parents=True, exist_ok=True)

(component_dir / "search-summary.component.ts").write_text("""import { Component, computed, input, signal } from '@angular/core';
import type { FacetGroup, FacetValue } from 'repository-api-client';

@Component({
  selector: 'app-search-summary',
  standalone: false,
  templateUrl: './search-summary.component.html',
  styleUrl: './search-summary.component.scss',
})
export class SearchSummaryComponent {
  readonly facet = input<FacetGroup | null>(null);
  readonly totalResults = input(0);
  readonly expanded = signal(false);

  readonly values = computed(() =>
    [...(this.facet()?.values ?? [])]
      .filter((value) => value.count > 0)
      .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label)),
  );
  readonly visibleValues = computed(() =>
    this.expanded() ? this.values() : this.values().slice(0, 4),
  );
  readonly hasMore = computed(() => this.values().length > 4);

  toggleExpanded(): void {
    this.expanded.update((expanded) => !expanded);
  }

  percentage(value: FacetValue): number {
    const total = this.totalResults();
    return total > 0 ? Math.round((value.count / total) * 100) : 0;
  }
}
""")

(component_dir / "search-summary.component.html").write_text("""@if (values().length > 0 && totalResults() > 0) {
<section class="search-summary" aria-labelledby="search-summary-title">
  <div class="search-summary__heading">
    <div>
      <p class="search-summary__eyebrow">Search snapshot</p>
      <h3 id="search-summary-title">Result type mix</h3>
    </div>
    <span class="search-summary__total">{{ totalResults() }} records</span>
  </div>

  <p class="search-summary__scope">
    Counts describe all records matching this search, not only the visible page.
  </p>

  <ul id="search-summary-values" class="search-summary__values">
    @for (value of visibleValues(); track value.value) {
    <li class="search-summary__value">
      <div class="search-summary__label-row">
        <span class="search-summary__label">{{ value.label }}</span>
        <span class="search-summary__count">
          {{ value.count }} · {{ percentage(value) }}%
        </span>
      </div>
      <div class="search-summary__track" aria-hidden="true">
        <span
          class="search-summary__bar"
          [style.width.%]="percentage(value)"
        ></span>
      </div>
    </li>
    }
  </ul>

  @if (hasMore()) {
  <button
    class="search-summary__toggle"
    type="button"
    aria-controls="search-summary-values"
    [attr.aria-expanded]="expanded()"
    (click)="toggleExpanded()"
  >
    {{ expanded() ? 'Show fewer types' : 'Show all ' + values().length + ' types' }}
  </button>
  }
</section>
}
""")

(component_dir / "search-summary.component.scss").write_text(""":host {
  display: block;
}

.search-summary {
  margin-bottom: 1rem;
  padding: 1rem;
  border: 1px solid var(--civics-border);
  border-radius: var(--civics-radius-md);
  background: var(--civics-surface-muted);
}

.search-summary__heading,
.search-summary__label-row {
  display: flex;
  gap: 0.75rem;
  align-items: baseline;
  justify-content: space-between;
}

.search-summary__eyebrow,
.search-summary__scope,
.search-summary__total,
.search-summary__values {
  margin: 0;
}

.search-summary__eyebrow {
  color: var(--civics-text-secondary);
  font-size: 0.7rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.search-summary h3 {
  margin: 0.2rem 0 0;
  font-size: 1.05rem;
}

.search-summary__total,
.search-summary__count {
  color: var(--civics-text-secondary);
  font-size: 0.78rem;
  font-weight: 700;
  white-space: nowrap;
}

.search-summary__scope {
  margin-top: 0.45rem;
  color: var(--civics-text-secondary);
  font-size: 0.82rem;
  line-height: 1.45;
}

.search-summary__values {
  display: grid;
  gap: 0.8rem;
  margin-top: 0.9rem;
  padding: 0;
  list-style: none;
}

.search-summary__value {
  display: grid;
  gap: 0.35rem;
}

.search-summary__label {
  min-width: 0;
  overflow-wrap: anywhere;
  font-size: 0.875rem;
  font-weight: 750;
}

.search-summary__track {
  height: 0.45rem;
  overflow: hidden;
  border: 1px solid var(--civics-border);
  border-radius: 999px;
  background: var(--civics-surface-panel);
}

.search-summary__bar {
  display: block;
  min-width: 0.2rem;
  height: 100%;
  border-radius: inherit;
  background: var(--mat-sys-primary);
}

.search-summary__toggle {
  min-height: 2.75rem;
  margin-top: 0.9rem;
  padding: 0.55rem 0.75rem;
  border: 1px solid var(--civics-border-strong);
  border-radius: var(--civics-radius-sm);
  background: var(--civics-surface-panel);
  color: var(--civics-text-primary);
  font: inherit;
  font-weight: 750;
  cursor: pointer;
}

@media (forced-colors: active) {
  .search-summary,
  .search-summary__track,
  .search-summary__toggle {
    border-color: CanvasText;
  }

  .search-summary__bar {
    background: Highlight;
  }
}
""")

(component_dir / "search-summary.component.spec.ts").write_text("""import { TestBed } from '@angular/core/testing';
import type { FacetGroup } from 'repository-api-client';
import { SearchSummaryComponent } from './search-summary.component';

const typeFacet: FacetGroup = {
  field: 'type',
  label: 'Type',
  values: [
    { value: 'DATASET', label: 'DATASET', count: 60, selected: false },
    { value: 'PUBLICATION', label: 'PUBLICATION', count: 25, selected: false },
    { value: 'METHODOLOGY', label: 'METHODOLOGY', count: 10, selected: false },
    { value: 'CODE', label: 'CODE', count: 4, selected: false },
    { value: 'PROJECT', label: 'PROJECT', count: 1, selected: false },
  ],
};

describe('SearchSummaryComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [SearchSummaryComponent],
    }).compileComponents();
  });

  it('renders exact query-wide counts and derived percentages', () => {
    const fixture = TestBed.createComponent(SearchSummaryComponent);
    fixture.componentRef.setInput('facet', typeFacet);
    fixture.componentRef.setInput('totalResults', 100);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('60 · 60%');
    expect(compiled.textContent).toContain('25 · 25%');
    expect(compiled.textContent).toContain('not only the visible page');
  });

  it('uses a Signal-backed disclosure for long type lists', () => {
    const fixture = TestBed.createComponent(SearchSummaryComponent);
    fixture.componentRef.setInput('facet', typeFacet);
    fixture.componentRef.setInput('totalResults', 100);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const button = compiled.querySelector<HTMLButtonElement>('.search-summary__toggle');
    expect(compiled.querySelectorAll('.search-summary__value')).toHaveLength(4);
    expect(button?.getAttribute('aria-expanded')).toBe('false');

    button?.click();
    fixture.detectChanges();

    expect(compiled.querySelectorAll('.search-summary__value')).toHaveLength(5);
    expect(button?.getAttribute('aria-expanded')).toBe('true');
    expect(button?.textContent).toContain('Show fewer types');
  });

  it('does not render when there is no facet evidence', () => {
    const fixture = TestBed.createComponent(SearchSummaryComponent);
    fixture.componentRef.setInput('facet', null);
    fixture.componentRef.setInput('totalResults', 100);
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent?.trim()).toBe('');
  });
});
""")

(component_dir / "search-summary.component.stories.ts").write_text("""import type { Meta, StoryObj } from '@storybook/angular';
import type { FacetGroup } from 'repository-api-client';
import { SearchSummaryComponent } from './search-summary.component';

const typeFacet: FacetGroup = {
  field: 'type',
  label: 'Type',
  values: [
    { value: 'DATASET', label: 'Dataset', count: 3420, selected: false },
    { value: 'PUBLICATION', label: 'Publication', count: 1280, selected: false },
    { value: 'METHODOLOGY', label: 'Methodology', count: 721, selected: false },
    { value: 'CODE', label: 'Code', count: 360, selected: false },
    { value: 'PROJECT', label: 'Project', count: 100, selected: false },
  ],
};

const meta: Meta<SearchSummaryComponent> = {
  title: 'Mobile Search/Search Summary',
  component: SearchSummaryComponent,
  parameters: {
    layout: 'padded',
    a11y: { test: 'error' },
  },
};

export default meta;
type Story = StoryObj<SearchSummaryComponent>;

export const QueryWideTypeMix: Story = {
  args: {
    facet: typeFacet,
    totalResults: 5881,
  },
};

export const Mobile320: Story = {
  args: {
    facet: typeFacet,
    totalResults: 5881,
  },
  parameters: {
    viewport: { defaultViewport: 'mobile1' },
  },
  render: (args) => ({
    props: args,
    template: `
      <div style="width: 288px; max-width: 100%; margin: 0 auto;">
        <app-search-summary [facet]="facet" [totalResults]="totalResults"></app-search-summary>
      </div>
    `,
  }),
};

export const SingleType: Story = {
  args: {
    facet: {
      field: 'type',
      label: 'Type',
      values: [{ value: 'DATASET', label: 'Dataset', count: 42, selected: false }],
    },
    totalResults: 42,
  },
};
""")

# App integration: derive the Type facet as presentation-only state and render it above the result list.
app_ts_path = Path("apps/census-mobile-frontend/src/app/app.ts")
app_ts = app_ts_path.read_text()
if "readonly resultTypeFacet" not in app_ts:
    app_ts = replace_once(
        app_ts,
        "  readonly resultCount = computed(() => this.response()?.totalResults ?? 0);\n",
        "  readonly resultCount = computed(() => this.response()?.totalResults ?? 0);\n  readonly resultTypeFacet = computed(\n    () =>\n      this.response()?.facets.find((facet) => facet.field === 'type') ?? null,\n  );\n",
        "result type facet computed state",
    )
app_ts_path.write_text(app_ts)

app_html_path = Path("apps/census-mobile-frontend/src/app/app.html")
app_html = app_html_path.read_text()
if "<app-search-summary" not in app_html:
    app_html = replace_once(
        app_html,
        "    @if (paginationNotice()) {\n",
        "    @if (searchResponse.query.trim() && resultTypeFacet()) {\n    <app-search-summary\n      [facet]=\"resultTypeFacet()\"\n      [totalResults]=\"searchResponse.totalResults\"\n    ></app-search-summary>\n    }\n\n    @if (paginationNotice()) {\n",
        "search summary render",
    )
app_html_path.write_text(app_html)

module_path = Path("apps/census-mobile-frontend/src/app/app-module.ts")
module = module_path.read_text()
if "SearchSummaryComponent" not in module:
    module = replace_once(
        module,
        "import { SearchRelevanceBadgeComponent } from './components/search-relevance-badge/search-relevance-badge.component';\n",
        "import { SearchRelevanceBadgeComponent } from './components/search-relevance-badge/search-relevance-badge.component';\nimport { SearchSummaryComponent } from './components/search-summary/search-summary.component';\n",
        "summary component import",
    )
    module = replace_once(
        module,
        "  declarations: [App, SearchRelevanceBadgeComponent],\n",
        "  declarations: [App, SearchRelevanceBadgeComponent, SearchSummaryComponent],\n",
        "summary component declaration",
    )
module_path.write_text(module)

spec_path = Path("apps/census-mobile-frontend/src/app/app.spec.ts")
spec = spec_path.read_text()
if "SearchSummaryComponent" not in spec:
    spec = replace_once(
        spec,
        "import { SearchRelevanceBadgeComponent } from './components/search-relevance-badge/search-relevance-badge.component';\n",
        "import { SearchRelevanceBadgeComponent } from './components/search-relevance-badge/search-relevance-badge.component';\nimport { SearchSummaryComponent } from './components/search-summary/search-summary.component';\n",
        "app spec summary import",
    )
    spec = replace_once(
        spec,
        "  facets: [],\n",
        "  facets: [\n    {\n      field: 'type',\n      label: 'Type',\n      values: [\n        { value: 'DATASET', label: 'Dataset', count: 4000, selected: false },\n        { value: 'PUBLICATION', label: 'Publication', count: 1881, selected: false },\n      ],\n    },\n  ],\n",
        "app spec type facet fixture",
    )
    spec = replace_once(
        spec,
        "      declarations: [App, SearchRelevanceBadgeComponent],\n",
        "      declarations: [App, SearchRelevanceBadgeComponent, SearchSummaryComponent],\n",
        "app spec declaration",
    )
    integration_test = """

  it('summarizes query-wide result types rather than only the visible page', () => {
    const store = TestBed.inject(Store);
    const fixture = TestBed.createComponent(App);

    store.dispatch(
      MobileSearchActions.searchLoaded({ response: searchResponse }),
    );
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const summary = compiled.querySelector('app-search-summary');
    expect(summary?.textContent).toContain('Result type mix');
    expect(summary?.textContent).toContain('4000 · 68%');
    expect(summary?.textContent).toContain('all records matching this search');
  });
"""
    spec = replace_once(spec, "\n  it('shows the submitted question while the repository is loading'", integration_test + "\n  it('shows the submitted question while the repository is loading'", "app summary integration test")
spec_path.write_text(spec)

# E2E fixture and assertions: exercise the summary at 320px with text-equivalent bars.
e2e_path = Path("apps/census-mobile-frontend-e2e/src/search-relevance.spec.ts")
e2e = e2e_path.read_text()
if "Result type mix" not in e2e:
    e2e = e2e.replace(
        "  band: 'STRONG' | 'GOOD' | 'MODERATE' | 'WEAK' | 'LOW',\n) => ({\n",
        "  band: 'STRONG' | 'GOOD' | 'MODERATE' | 'WEAK' | 'LOW',\n  contentType: 'DATASET' | 'PUBLICATION' = 'DATASET',\n) => ({\n",
        1,
    )
    e2e = e2e.replace("  contentType: 'DATASET',\n  program: 'OTHER',", "  contentType,\n  program: 'OTHER',", 1)
    e2e = e2e.replace(
        "              0.3,\n              'WEAK',\n            ),",
        "              0.3,\n              'WEAK',\n              'PUBLICATION',\n            ),",
        1,
    )
    e2e = e2e.replace(
        "          facets: [],\n          relevanceModel:",
        "          facets: [\n            {\n              field: 'type',\n              label: 'Type',\n              values: [\n                { value: 'DATASET', label: 'Dataset', count: 1, selected: false },\n                { value: 'PUBLICATION', label: 'Publication', count: 1, selected: false },\n              ],\n            },\n          ],\n          relevanceModel:",
        1,
    )
    e2e = e2e.replace(
        "    await expect(\n      page.getByText('Match labels are query-relative search evidence'),\n    ).toBeVisible();\n",
        "    await expect(\n      page.getByText('Match labels are query-relative search evidence'),\n    ).toBeVisible();\n    await expect(page.getByRole('heading', { name: 'Result type mix' })).toBeVisible();\n    await expect(page.getByText('1 · 50%').first()).toBeVisible();\n    await expect(\n      page.getByText('Counts describe all records matching this search'),\n    ).toBeVisible();\n",
        1,
    )
e2e_path.write_text(e2e)

# Backlog now reflects the actual stack sequence rather than the original proposal numbering.
backlog_path = Path("mobile-first/planning/backlog.md")
backlog = backlog_path.read_text()
backlog = backlog.replace("Status: proposed", "Status: active development", 1)
if "## Implementation Progress" not in backlog:
    progress = """
## Implementation Progress

The original PR numbering below was a planning sequence, not a permanent branch contract. The implemented stack has intentionally combined some evidence work earlier where it reduced risk:

- PR #86 delivered scalable mobile pagination, global rank, summaries, and the North Dakota migration acceptance query.
- PR #87 delivers engine-backed query-relative relevance bands, mobile Storybook, 320px Playwright/axe evidence, and `start:all` integration for the mobile frontend.
- The current PR 6 slice starts the planned search-summary work with an accessible query-wide result-type mix driven by server-returned facets.
- Broader filter-drawer/URL orchestration from the separate richer search-container line is not being merged into this state machine implicitly; convergence must remain deliberate.

"""
    backlog = replace_once(backlog, "## PR 1: Planning and Workspace Baseline\n", progress + "## PR 1: Planning and Workspace Baseline\n", "backlog implementation progress")
backlog_path.write_text(backlog)
