import { readFile, writeFile } from 'node:fs/promises';

const PAGE_TS = 'apps/discovery-ui/src/app/pages/maps-page.ts';
const PAGE_HTML = 'apps/discovery-ui/src/app/pages/maps-page.html';
const PAGE_UTILS = 'apps/discovery-ui/src/app/pages/maps-page.utils.ts';
const EFFECTS_SPEC = 'apps/discovery-ui/src/app/state/maps/maps.effects.spec.ts';
const LAYOUT_SCSS = 'libs/shared/material/src/lib/theme/civics-layout.scss';

function replaceOnce(source, before, after, label) {
  const index = source.indexOf(before);
  if (index < 0) {
    throw new Error(`Could not find ${label}`);
  }
  if (source.indexOf(before, index + before.length) >= 0) {
    throw new Error(`Expected one ${label}, found more than one`);
  }
  return source.slice(0, index) + after + source.slice(index + before.length);
}

function replaceBetween(source, start, end, replacement, label) {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);
  if (startIndex < 0 || endIndex < 0) {
    throw new Error(`Could not find ${label}`);
  }
  return source.slice(0, startIndex) + replacement + source.slice(endIndex);
}

function replaceLast(source, before, after, label) {
  const index = source.lastIndexOf(before);
  if (index < 0) {
    throw new Error(`Could not find ${label}`);
  }
  return source.slice(0, index) + after + source.slice(index + before.length);
}

async function patchMapsPageTs() {
  let source = await readFile(PAGE_TS, 'utf8');

  source = replaceOnce(
    source,
    `  MapLayer,\n  SaipeCountyChoropleth,\n  UsgsEarthquakeOverlay,`,
    `  MapLayer,\n  ResearchObjectType,\n  SaipeCountyChoropleth,\n  SearchQuery,\n  SourceSystem,\n  UsgsEarthquakeOverlay,`,
    'repository API type imports',
  );

  source = replaceOnce(
    source,
    `  selectMapsError,\n  selectMapsLoading,\n  selectSaipeChoropleth,`,
    `  selectMapsError,\n  selectMapsLoading,\n  selectResearchCoverageError,\n  selectResearchCoverageSummary,\n  selectResearchCoverageVisible,\n  selectSaipeChoropleth,`,
    'research coverage selector imports',
  );

  source = replaceOnce(
    source,
    `} from '../state/maps/maps.selectors';\nimport {`,
    `} from '../state/maps/maps.selectors';\nimport type { ResearchCoverageSummary } from '../state/maps/research-coverage';\nimport {`,
    'research coverage summary import',
  );

  source = replaceOnce(
    source,
    `type GeoJsonFeatureCollection = {\n  type: 'FeatureCollection';\n  features: unknown[];\n};`,
    `type GeoJsonFeatureCollection = {\n  type: 'FeatureCollection';\n  features: unknown[];\n};\n\ntype ResearchCoverageFeatureCollection = {\n  type: 'FeatureCollection';\n  features: {\n    type: 'Feature';\n    properties: {\n      geography: string;\n      count: number;\n      radius: number;\n    };\n    geometry: {\n      type: 'Point';\n      coordinates: [number, number];\n    };\n  }[];\n};`,
    'research coverage GeoJSON type',
  );

  source = replaceOnce(
    source,
    `  private pendingHydrographyLayer: MapLayer | null = null;`,
    `  private pendingHydrographyLayer: MapLayer | null = null;\n  private pendingResearchCoverage: ResearchCoverageSummary | null = null;`,
    'pending research coverage field',
  );

  source = replaceOnce(
    source,
    `  private saipeVisible = false;`,
    `  private saipeVisible = false;\n  private researchCoverageVisible = false;`,
    'research coverage visibility field',
  );

  source = replaceOnce(
    source,
    `  private selectedGeography = 'North Dakota';`,
    `  private selectedGeography = 'North Dakota';\n  private researchCoverageCriteria: SearchQuery = { page: 0, pageSize: 1 };\n  private researchCoverageFingerprint = '';`,
    'research coverage criteria fields',
  );

  source = replaceOnce(
    source,
    `    saipe:\n      'Colors counties by SAIPE poverty rate for the selected state. The county value table below lists the same statistics shown on the map.',\n    hydrography:`,
    `    saipe:\n      'Colors counties by SAIPE poverty rate for the selected state. The county value table below lists the same statistics shown on the map.',\n    research:\n      'Shows matching research-object counts only where retained metadata explicitly names a supported Census area. Records without explicit research geography are counted as not mapped; publisher or institution locations are never substituted.',\n    hydrography:`,
    'research coverage tooltip',
  );

  source = replaceOnce(
    source,
    `  protected readonly saipeChoroplethError$ = this.store.select(\n    selectSaipeChoroplethError,\n  );`,
    `  protected readonly saipeChoroplethError$ = this.store.select(\n    selectSaipeChoroplethError,\n  );\n  protected readonly researchCoverageSummary$ = this.store.select(\n    selectResearchCoverageSummary,\n  );\n  protected readonly researchCoverageError$ = this.store.select(\n    selectResearchCoverageError,\n  );\n  protected readonly researchCoverageVisible$ = this.store.select(\n    selectResearchCoverageVisible,\n  );`,
    'research coverage observables',
  );

  source = replaceOnce(
    source,
    `    this.hydrographyLayer$\n      .pipe(takeUntilDestroyed(this.destroyRef))`,
    `    this.researchCoverageSummary$\n      .pipe(takeUntilDestroyed(this.destroyRef))\n      .subscribe((summary) => {\n        this.pendingResearchCoverage = summary;\n        this.renderResearchCoverage();\n      });\n\n    this.hydrographyLayer$\n      .pipe(takeUntilDestroyed(this.destroyRef))`,
    'research coverage subscription',
  );

  source = replaceOnce(
    source,
    `      this.hydrographyVisible$,\n      this.saipeVisible$,\n    ])`,
    `      this.hydrographyVisible$,\n      this.saipeVisible$,\n      this.researchCoverageVisible$,\n    ])`,
    'research coverage visibility combineLatest source',
  );

  source = replaceOnce(
    source,
    `          hydrographyVisible,\n          saipeVisible,\n        ]) => {`,
    `          hydrographyVisible,\n          saipeVisible,\n          researchCoverageVisible,\n        ]) => {`,
    'research coverage visibility tuple',
  );

  source = replaceOnce(
    source,
    `          this.saipeVisible = saipeVisible;\n          this.applyLayerVisibility();`,
    `          this.saipeVisible = saipeVisible;\n          this.researchCoverageVisible = researchCoverageVisible;\n          this.applyLayerVisibility();`,
    'research coverage visibility assignment',
  );

  source = replaceOnce(
    source,
    `  protected toggleSaipeLayer(visible: boolean): void {\n    this.store.dispatch(MapsActions.saipeLayerToggled({ visible }));\n    this.updateMapUrl({ saipeVisible: visible });\n  }`,
    `  protected toggleSaipeLayer(visible: boolean): void {\n    this.store.dispatch(MapsActions.saipeLayerToggled({ visible }));\n    this.updateMapUrl({ saipeVisible: visible });\n  }\n\n  protected toggleResearchCoverageLayer(visible: boolean): void {\n    this.store.dispatch(\n      MapsActions.researchCoverageLayerToggled({ visible }),\n    );\n    this.updateMapUrl({ researchCoverageVisible: visible });\n  }`,
    'research coverage toggle method',
  );

  const researchStart = `  /**\n   * Research context carried in from discovery.`;
  const researchEnd = `  private bindUrlState(): void {`;
  const newResearchContext = `  /**\n   * Research context carried in from Discovery.\n   *\n   * Unlike the original decorative query label, Maps now reuses the exact effective search\n   * criteria for one bounded facet request. Solr/OpenSearch aggregate geography over the complete\n   * result set; the browser never receives the matching result list just to draw coverage.\n   */\n  protected readonly workforceView = signal(false);\n  protected readonly researchQuery = signal<string | null>(null);\n\n  private bindResearchContext(): void {\n    this.route.queryParamMap\n      .pipe(takeUntilDestroyed(this.destroyRef))\n      .subscribe((params) => {\n        this.workforceView.set(params.get('view') === 'workforce');\n        const q = params.get('q')?.trim() ?? '';\n        this.researchQuery.set(q || null);\n        const programs = params\n          .getAll('program')\n          .map((value) => value.trim())\n          .filter(Boolean);\n        const publisher = params.get('publisher')?.trim() ?? '';\n        const sourceSystem = params.get('sourceSystem')?.trim() ?? '';\n        const geography = params.get('geography')?.trim() ?? '';\n        const contentType = params.get('type')?.trim() ?? '';\n        const vintageYearValue = Number(params.get('vintageYear'));\n        const vintageYear =\n          Number.isInteger(vintageYearValue) && vintageYearValue > 0\n            ? vintageYearValue\n            : null;\n\n        const query: SearchQuery = {\n          q,\n          page: 0,\n          pageSize: 1,\n          ...(programs.length ? { programs } : {}),\n          ...(publisher ? { publisher } : {}),\n          ...(sourceSystem\n            ? { sourceSystem: sourceSystem as SourceSystem }\n            : {}),\n          ...(geography ? { geography } : {}),\n          ...(contentType\n            ? { contentType: contentType as ResearchObjectType }\n            : {}),\n          ...(vintageYear !== null ? { vintageYear } : {}),\n        };\n\n        this.researchCoverageCriteria = query;\n        const fingerprint = JSON.stringify(query);\n        if (fingerprint !== this.researchCoverageFingerprint) {\n          this.researchCoverageFingerprint = fingerprint;\n          this.store.dispatch(\n            MapsActions.researchCoverageRequested({ query }),\n          );\n        }\n      });\n  }\n\n  /** Query parameters that reconstruct the effective Discovery search. */\n  protected backToSearchParams(): Record<string, string | string[]> {\n    const query = this.researchCoverageCriteria;\n    return {\n      ...(query.q ? { q: query.q } : {}),\n      ...(query.programs?.length ? { program: [...query.programs] } : {}),\n      ...(query.publisher ? { publisher: query.publisher } : {}),\n      ...(query.sourceSystem ? { sourceSystem: query.sourceSystem } : {}),\n      ...(query.geography ? { geography: query.geography } : {}),\n      ...(query.contentType ? { type: query.contentType } : {}),\n      ...(query.vintageYear !== undefined\n        ? { vintageYear: String(query.vintageYear) }\n        : {}),\n    };\n  }\n\n  protected researchAreaSearchParams(\n    geography: string,\n  ): Record<string, string | string[]> {\n    return { ...this.backToSearchParams(), geography };\n  }\n\n`;
  source = replaceBetween(
    source,
    researchStart,
    researchEnd,
    newResearchContext,
    'research context block',
  );

  source = replaceOnce(
    source,
    `          saipeVisible: this.toVisibleState(params.get('saipe')),\n          featureId: params.get('feature'),`,
    `          saipeVisible: this.toVisibleState(params.get('saipe')),\n          researchCoverageVisible: this.toVisibleState(params.get('research')),\n          featureId: params.get('feature'),`,
    'research URL visibility parsing',
  );

  source = replaceOnce(
    source,
    `            previous.saipeVisible === current.saipeVisible &&\n            previous.featureId === current.featureId,`,
    `            previous.saipeVisible === current.saipeVisible &&\n            previous.researchCoverageVisible ===\n              current.researchCoverageVisible &&\n            previous.featureId === current.featureId,`,
    'research URL distinct comparison',
  );

  source = replaceOnce(
    source,
    `          saipeVisible,\n          featureId,`,
    `          saipeVisible,\n          researchCoverageVisible,\n          featureId,`,
    'research URL subscription destructuring',
  );

  source = replaceOnce(
    source,
    `          if (saipeVisible !== null) {\n            this.store.dispatch(\n              MapsActions.saipeLayerToggled({ visible: saipeVisible }),\n            );\n          }\n\n          if (featureId) {`,
    `          if (saipeVisible !== null) {\n            this.store.dispatch(\n              MapsActions.saipeLayerToggled({ visible: saipeVisible }),\n            );\n          }\n\n          if (researchCoverageVisible !== null) {\n            this.store.dispatch(\n              MapsActions.researchCoverageLayerToggled({\n                visible: researchCoverageVisible,\n              }),\n            );\n          }\n\n          if (featureId) {`,
    'research URL state dispatch',
  );

  source = replaceOnce(
    source,
    `    saipeVisible?: boolean;\n    featureId?: string | null;`,
    `    saipeVisible?: boolean;\n    researchCoverageVisible?: boolean;\n    featureId?: string | null;`,
    'research updateMapUrl option',
  );

  source = replaceOnce(
    source,
    `        saipe:\n          options.saipeVisible === undefined\n            ? undefined\n            : this.toLayerParam(options.saipeVisible),`,
    `        saipe:\n          options.saipeVisible === undefined\n            ? undefined\n            : this.toLayerParam(options.saipeVisible),\n        research:\n          options.researchCoverageVisible === undefined\n            ? undefined\n            : options.researchCoverageVisible\n              ? 'on'\n              : 'off',`,
    'research updateMapUrl query parameter',
  );

  source = replaceOnce(
    source,
    `    this.renderSaipeChoropleth();\n    this.renderHydrographyLayer();`,
    `    this.renderSaipeChoropleth();\n    this.renderResearchCoverage();\n    this.renderHydrographyLayer();`,
    'research overlay synchronization',
  );

  source = replaceOnce(
    source,
    `  private renderHydrographyLayer(): void {`,
    `  /**\n   * Bounded repository research-by-area summary.\n   *\n   * These are state-summary symbols, not scientific footprints. Each symbol exists only when the\n   * normalized research metadata explicitly names a supported Census area; unmapped matches stay\n   * visible in the semantic summary instead of being assigned a publisher location.\n   */\n  private renderResearchCoverage(): void {\n    if (!this.map || !this.mapStyleReady || !this.pendingResearchCoverage) {\n      return;\n    }\n\n    const data = this.createResearchCoverageGeoJson(\n      this.pendingResearchCoverage,\n    );\n    const existingSource = this.map.getSource(\n      'repository-research-coverage',\n    ) as GeoJSONSource | null;\n\n    if (existingSource) {\n      existingSource.setData(data);\n      this.applyLayerVisibility();\n      return;\n    }\n\n    this.map.addSource('repository-research-coverage', {\n      type: 'geojson',\n      data,\n    });\n\n    this.map.addLayer({\n      id: 'repository-research-coverage-circles',\n      type: 'circle',\n      source: 'repository-research-coverage',\n      layout: {\n        visibility: this.researchCoverageVisible ? 'visible' : 'none',\n      },\n      paint: {\n        'circle-color': '#0f766e',\n        'circle-opacity': 0.72,\n        'circle-stroke-color': '#ffffff',\n        'circle-stroke-width': 2,\n        'circle-radius': [\n          'to-number',\n          ['get', 'radius'],\n        ] as DataDrivenPropertyValueSpecification<number>,\n      },\n    });\n\n    this.map.addLayer({\n      id: 'repository-research-coverage-labels',\n      type: 'symbol',\n      source: 'repository-research-coverage',\n      layout: {\n        visibility: this.researchCoverageVisible ? 'visible' : 'none',\n        'text-field': ['to-string', ['get', 'count']],\n        'text-size': 12,\n        'text-allow-overlap': false,\n      },\n      paint: {\n        'text-color': '#ffffff',\n        'text-halo-color': '#134e4a',\n        'text-halo-width': 1,\n      },\n    });\n\n    this.applyLayerVisibility();\n  }\n\n  private renderHydrographyLayer(): void {`,
    'research coverage renderer',
  );

  source = replaceOnce(
    source,
    `  private createEarthquakeGeoJson(\n    overlay: UsgsEarthquakeOverlay,\n  ): EarthquakeFeatureCollection {`,
    `  private createResearchCoverageGeoJson(\n    summary: ResearchCoverageSummary,\n  ): ResearchCoverageFeatureCollection {\n    const largest = Math.max(1, ...summary.areas.map((area) => area.count));\n\n    return {\n      type: 'FeatureCollection',\n      features: summary.areas.map((area) => ({\n        type: 'Feature',\n        properties: {\n          geography: area.geography,\n          count: area.count,\n          radius: 7 + 21 * Math.sqrt(area.count / largest),\n        },\n        geometry: {\n          type: 'Point',\n          coordinates: [area.centerLongitude, area.centerLatitude],\n        },\n      })),\n    };\n  }\n\n  private createEarthquakeGeoJson(\n    overlay: UsgsEarthquakeOverlay,\n  ): EarthquakeFeatureCollection {`,
    'research coverage GeoJSON builder',
  );

  source = replaceOnce(
    source,
    `      saipe: this.saipeVisible,\n      hydrography: this.hydrographyVisible,`,
    `      saipe: this.saipeVisible,\n      research: this.researchCoverageVisible,\n      hydrography: this.hydrographyVisible,`,
    'research layer debug toggle state',
  );

  await writeFile(PAGE_TS, source, 'utf8');
}

async function patchMapsPageHtml() {
  let source = await readFile(PAGE_HTML, 'utf8');

  const category = `\n\n        @if (researchCoverageSummary$ | async; as researchCoverage) {\n        <details\n          class="layer-category"\n          data-testid="map-layer-category-research-coverage"\n          open\n        >\n          <summary data-testid="map-layer-category-research-coverage-summary">\n            <span class="layer-category-summary-content">\n              <span class="layer-category-title">Research Coverage</span>\n              <span class="layer-category-count">1 layer</span>\n            </span>\n          </summary>\n\n          <div class="layer-category-items">\n            <span class="layer-toggle-row">\n              <label class="layer-toggle">\n                <input\n                  type="checkbox"\n                  data-testid="map-layer-research-coverage"\n                  [checked]="researchCoverageVisible$ | async"\n                  (change)="toggleResearchCoverageLayer($any($event.target).checked)"\n                />\n                <span class="layer-toggle-label">Repository research by area</span>\n              </label>\n              <button\n                type="button"\n                class="layer-info-button"\n                mat-icon-button\n                data-testid="map-layer-research-coverage-info"\n                [matTooltip]="layerTooltips.research"\n                matTooltipPosition="above"\n                aria-label="About Repository research by area layer"\n              >\n                <mat-icon aria-hidden="true">info_outline</mat-icon>\n              </button>\n            </span>\n          </div>\n        </details>\n        }`;
  source = replaceLast(
    source,
    `        </details>\n      </fieldset>`,
    `        </details>${category}\n      </fieldset>`,
    'Research Coverage category insertion point',
  );

  source = replaceOnce(
    source,
    `            LODES workplace flows and TIGER/Line geography, with SAIPE county\n            context where retained for the selected area`,
    `            LODES workplace flows and TIGER/Line geography, with SAIPE county\n            context where retained for the selected area and repository research\n            coverage where records explicitly name a supported Census area`,
    'research context active data copy',
  );

  source = replaceOnce(
    source,
    `    } @if (earthquakeStale$ | async) {`,
    `    } @if (researchCoverageError$ | async; as researchCoverageError) {\n    <p class="warning-message" role="status">\n      Repository research coverage unavailable: {{ researchCoverageError }}\n    </p>\n    } @if (earthquakeStale$ | async) {`,
    'research coverage warning',
  );

  source = replaceOnce(
    source,
    `          } } @if (hydrographyVisible$ | async) {`,
    `          } } @if (researchCoverageVisible$ | async) { @if\n          (researchCoverageSummary$ | async; as researchCoverage) {\n          <li>\n            <span class="swatch research"></span>\n            Repository research by area ({{ researchCoverage.mappedResults |\n            number }} mapped of {{ researchCoverage.totalResults | number }}\n            matching)\n          </li>\n          } } @if (hydrographyVisible$ | async) {`,
    'research coverage legend entry',
  );

  const tableBlock = `\n      @if (researchCoverageVisible$ | async) { @if (researchCoverageSummary$ |\n      async; as researchCoverage) {\n      <section\n        class="research-coverage-summary"\n        aria-labelledby="research-coverage-summary-heading"\n      >\n        <h3 id="research-coverage-summary-heading">Repository research by area</h3>\n        <p>\n          {{ researchCoverage.mappedResults | number }} of {{\n          researchCoverage.totalResults | number }} matching research objects\n          explicitly name a supported Census area. {{\n          researchCoverage.unmappedResults | number }} matching objects are not\n          drawn; publisher, laboratory, author, and institution locations are not\n          substituted for research geography.\n        </p>\n        @if (researchCoverage.areas.length) {\n        <table class="county-value-table">\n          <caption>\n            Matching research objects with explicit administrative geography\n          </caption>\n          <thead>\n            <tr>\n              <th scope="col">Census area</th>\n              <th scope="col">Matching research objects</th>\n              <th scope="col">Discovery</th>\n            </tr>\n          </thead>\n          <tbody>\n            @for (area of researchCoverage.areas; track area.id) {\n            <tr>\n              <th scope="row">{{ area.geography }}</th>\n              <td>{{ area.count | number }}</td>\n              <td>\n                <a\n                  [routerLink]="['/discovery']"\n                  [queryParams]="researchAreaSearchParams(area.geography)"\n                  >View matching research</a\n                >\n              </td>\n            </tr>\n            }\n          </tbody>\n        </table>\n        } @else {\n        <p class="feature-hint">\n          No matching records currently expose supported explicit administrative\n          geography for this search.\n        </p>\n        }\n      </section>\n      } }\n`;
  source = replaceOnce(
    source,
    `      @if (saipeVisible$ | async) { @if (saipeChoropleth$ | async; as saipe) {`,
    `${tableBlock}\n      @if (saipeVisible$ | async) { @if (saipeChoropleth$ | async; as saipe) {`,
    'research coverage semantic table insertion point',
  );

  await writeFile(PAGE_HTML, source, 'utf8');
}

async function patchMapUtils() {
  let source = await readFile(PAGE_UTILS, 'utf8');
  source = replaceOnce(
    source,
    `  | 'saipe'\n  | 'hydrography';`,
    `  | 'saipe'\n  | 'research'\n  | 'hydrography';`,
    'research debug group type',
  );
  source = replaceOnce(
    source,
    `  {\n    id: 'hydrography',\n    label: 'USGS 3HP hydrography',`,
    `  {\n    id: 'research',\n    label: 'Repository research by area',\n    sourceId: 'repository-research-coverage',\n    layerIds: [\n      'repository-research-coverage-circles',\n      'repository-research-coverage-labels',\n    ],\n  },\n  {\n    id: 'hydrography',\n    label: 'USGS 3HP hydrography',`,
    'research debug group',
  );
  await writeFile(PAGE_UTILS, source, 'utf8');
}

async function patchEffectsSpec() {
  let source = await readFile(EFFECTS_SPEC, 'utf8');
  source = replaceOnce(
    source,
    `  RepositoryMapsApi,\n  type CensusAreaBoundary,`,
    `  RepositoryMapsApi,\n  RepositorySearchApi,\n  type CensusAreaBoundary,\n  type SearchResponse,`,
    'search API test imports',
  );

  source = replaceOnce(
    source,
    `const earthquakeOverlay = {`,
    `const searchResponse = {\n  resultSource: 'REPOSITORY',\n  query: 'climate',\n  page: 0,\n  pageSize: 1,\n  totalResults: 8,\n  results: [],\n  facets: [],\n} as unknown as SearchResponse;\n\nconst earthquakeOverlay = {`,
    'search response fixture',
  );

  source = replaceOnce(
    source,
    `function setup(\n  mapsApi: Partial<RepositoryMapsApi>,\n  actions$: Observable<unknown>,\n  selectedGeography = 'North Dakota',\n) {`,
    `function setup(\n  mapsApi: Partial<RepositoryMapsApi>,\n  actions$: Observable<unknown>,\n  selectedGeography = 'North Dakota',\n  searchApi: Partial<RepositorySearchApi> = {\n    searchResearchObjects: vi.fn().mockReturnValue(of(searchResponse)),\n  },\n) {`,
    'effects spec setup signature',
  );

  source = replaceOnce(
    source,
    `      { provide: RepositoryMapsApi, useValue: mapsApi },`,
    `      { provide: RepositoryMapsApi, useValue: mapsApi },\n      { provide: RepositorySearchApi, useValue: searchApi },`,
    'effects spec search API provider',
  );

  const testBlock = `\n\n  it('loads Research Coverage through one bounded search facet request', async () => {\n    const searchResearchObjects = vi.fn().mockReturnValue(of(searchResponse));\n    const query = {\n      q: 'climate',\n      programs: ['NASA'],\n      publisher: 'NASA',\n      sourceSystem: 'DATA_GOV' as const,\n      geography: 'California',\n      page: 7,\n      pageSize: 25,\n    };\n    const effects = setup(\n      {},\n      of(MapsActions.researchCoverageRequested({ query })),\n      'North Dakota',\n      { searchResearchObjects } as unknown as RepositorySearchApi,\n    );\n\n    const emitted = await firstValueFrom(effects.loadResearchCoverage$);\n\n    expect(searchResearchObjects).toHaveBeenCalledWith({\n      ...query,\n      page: 0,\n      pageSize: 1,\n    });\n    expect(emitted).toEqual(\n      MapsActions.researchCoverageLoaded({ response: searchResponse }),\n    );\n  });\n`;
  source = replaceLast(
    source,
    `\n});\n`,
    `${testBlock}\n});\n`,
    'effects spec closing describe',
  );

  await writeFile(EFFECTS_SPEC, source, 'utf8');
}

async function patchStyles() {
  let source = await readFile(LAYOUT_SCSS, 'utf8');
  source = replaceOnce(
    source,
    `.swatch.hydrography {\n  background: #0284c7;\n}`,
    `.swatch.research {\n  background: #0f766e;\n}\n\n.swatch.hydrography {\n  background: #0284c7;\n}`,
    'research coverage legend swatch',
  );
  await writeFile(LAYOUT_SCSS, source, 'utf8');
}

await patchMapsPageTs();
await patchMapsPageHtml();
await patchMapUtils();
await patchEffectsSpec();
await patchStyles();

console.log('Research Coverage UI transform applied.');
