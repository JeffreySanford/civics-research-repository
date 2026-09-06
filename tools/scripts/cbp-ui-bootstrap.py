from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f"Anchor not found for {label}")
    return text.replace(old, new, 1)


def patch_maps_page_ts() -> None:
    path = Path("apps/discovery-ui/src/app/pages/maps-page.ts")
    text = path.read_text()

    text = replace_once(
        text,
        "  CensusAreaBoundary,\n  LodesFlowOverlay,",
        "  CensusAreaBoundary,\n  CountyBusinessPatternsChoropleth,\n  CountyBusinessPatternsIndustry,\n  CountyBusinessPatternsMeasure,\n  LodesFlowOverlay,",
        "CBP API type imports",
    )
    text = replace_once(
        text,
        "  selectCensusAreaBoundaries,\n  selectEarthquakeError,",
        "  selectCensusAreaBoundaries,\n  selectCountyBusinessPatternsAvailable,\n  selectCountyBusinessPatternsChoropleth,\n  selectCountyBusinessPatternsError,\n  selectCountyBusinessPatternsIndustry,\n  selectCountyBusinessPatternsLoading,\n  selectCountyBusinessPatternsMeasure,\n  selectCountyBusinessPatternsVisible,\n  selectCountyBusinessPatternsYear,\n  selectEarthquakeError,",
        "CBP selector imports",
    )
    text = replace_once(
        text,
        "import { PopulationEstimatesSummaryComponent } from './population-estimates-summary.component';",
        "import { buildCountyBusinessPatternsScale } from './county-business-patterns-scale';\nimport { CountyBusinessPatternsSummaryComponent } from './county-business-patterns-summary.component';\nimport { PopulationEstimatesSummaryComponent } from './population-estimates-summary.component';",
        "CBP page imports",
    )
    text = replace_once(
        text,
        "    MatTooltipModule,\n    PopulationEstimatesSummaryComponent,",
        "    MatTooltipModule,\n    CountyBusinessPatternsSummaryComponent,\n    PopulationEstimatesSummaryComponent,",
        "CBP component registration",
    )
    text = replace_once(
        text,
        "  private pendingPopulationEstimates: PopulationEstimatesChoropleth | null =\n    null;",
        "  private pendingPopulationEstimates: PopulationEstimatesChoropleth | null =\n    null;\n  private pendingCountyBusinessPatterns: CountyBusinessPatternsChoropleth | null =\n    null;",
        "CBP pending overlay",
    )
    text = replace_once(
        text,
        "  private populationEstimateYear = 2025;\n  private researchCoverageVisible = false;",
        "  private populationEstimateYear = 2025;\n  private countyBusinessPatternsVisible = false;\n  private countyBusinessPatternsMeasure: CountyBusinessPatternsMeasure =\n    'ESTABLISHMENTS';\n  private countyBusinessPatternsIndustry: CountyBusinessPatternsIndustry =\n    'TOTAL';\n  private countyBusinessPatternsYear = 2023;\n  private researchCoverageVisible = false;",
        "CBP local configuration",
    )
    text = replace_once(
        text,
        "    population:\n      'Colors counties using Census Population Estimates Program Vintage 2025 values. Population uses a sequential scale; annual change and annual growth use a diverging scale centered at zero. Colors do not imply statistical significance.',\n    research:",
        "    population:\n      'Colors counties using Census Population Estimates Program Vintage 2025 values. Population uses a sequential scale; annual change and annual growth use a diverging scale centered at zero. Colors do not imply statistical significance.',\n    cbp:\n      'Colors counties using the pinned 2023 Census County Business Patterns source. Choose establishments, employment, or payroll and a 2-digit NAICS sector. Gray means the county/industry row is unavailable in the published source, never zero.',\n    research:",
        "CBP tooltip",
    )
    text = replace_once(
        text,
        "  protected readonly populationAvailable$ = this.store.select(\n    selectPopulationEstimatesAvailable,\n  );",
        "  protected readonly populationAvailable$ = this.store.select(\n    selectPopulationEstimatesAvailable,\n  );\n  protected readonly countyBusinessPatternsAvailable$ = this.store.select(\n    selectCountyBusinessPatternsAvailable,\n  );",
        "CBP availability observable",
    )
    text = replace_once(
        text,
        "  protected readonly populationVisible$ = this.store.select(\n    selectPopulationVisible,\n  );\n\n  protected readonly researchCoverageSummary$",
        "  protected readonly populationVisible$ = this.store.select(\n    selectPopulationVisible,\n  );\n\n  protected readonly countyBusinessPatternsChoropleth$ = this.store.select(\n    selectCountyBusinessPatternsChoropleth,\n  );\n  protected readonly countyBusinessPatternsScale$ =\n    this.countyBusinessPatternsChoropleth$.pipe(\n      map((choropleth) =>\n        choropleth ? buildCountyBusinessPatternsScale(choropleth) : null,\n      ),\n    );\n  protected readonly countyBusinessPatternsError$ = this.store.select(\n    selectCountyBusinessPatternsError,\n  );\n  protected readonly countyBusinessPatternsLoading$ = this.store.select(\n    selectCountyBusinessPatternsLoading,\n  );\n  protected readonly countyBusinessPatternsMeasure$ = this.store.select(\n    selectCountyBusinessPatternsMeasure,\n  );\n  protected readonly countyBusinessPatternsIndustry$ = this.store.select(\n    selectCountyBusinessPatternsIndustry,\n  );\n  protected readonly countyBusinessPatternsYear$ = this.store.select(\n    selectCountyBusinessPatternsYear,\n  );\n  protected readonly countyBusinessPatternsVisible$ = this.store.select(\n    selectCountyBusinessPatternsVisible,\n  );\n  protected readonly countyBusinessPatternsYears = [2023] as const;\n  protected readonly countyBusinessPatternsIndustries: readonly {\n    code: CountyBusinessPatternsIndustry;\n    label: string;\n  }[] = [\n    { code: 'TOTAL', label: 'All sectors' },\n    { code: '11', label: '11 Agriculture, forestry, fishing & hunting' },\n    { code: '21', label: '21 Mining, quarrying, oil & gas' },\n    { code: '22', label: '22 Utilities' },\n    { code: '23', label: '23 Construction' },\n    { code: '31', label: '31-33 Manufacturing' },\n    { code: '42', label: '42 Wholesale trade' },\n    { code: '44', label: '44-45 Retail trade' },\n    { code: '48', label: '48-49 Transportation & warehousing' },\n    { code: '51', label: '51 Information' },\n    { code: '52', label: '52 Finance & insurance' },\n    { code: '53', label: '53 Real estate, rental & leasing' },\n    { code: '54', label: '54 Professional, scientific & technical services' },\n    { code: '55', label: '55 Management of companies & enterprises' },\n    { code: '56', label: '56 Administrative support & waste services' },\n    { code: '61', label: '61 Educational services' },\n    { code: '62', label: '62 Health care & social assistance' },\n    { code: '71', label: '71 Arts, entertainment & recreation' },\n    { code: '72', label: '72 Accommodation & food services' },\n    { code: '81', label: '81 Other services' },\n    { code: '99', label: '99 Industries not classified' },\n  ];\n\n  protected readonly researchCoverageSummary$",
        "CBP observables",
    )
    text = replace_once(
        text,
        "    this.store.select(selectSaipeVisible),\n    this.store.select(selectPopulationVisible),\n  ]).pipe(",
        "    this.store.select(selectSaipeVisible),\n    this.store.select(selectPopulationVisible),\n    this.store.select(selectCountyBusinessPatternsVisible),\n  ]).pipe(",
        "CBP visible layer selector",
    )
    text = replace_once(
        text,
        "        saipeVisible,\n        populationVisible,\n      ]) =>",
        "        saipeVisible,\n        populationVisible,\n        countyBusinessPatternsVisible,\n      ]) =>",
        "CBP visible layer destructuring",
    )
    text = replace_once(
        text,
        "              if (layer.id.startsWith('population-estimates-county-')) {\n                return populationVisible;\n              }\n              return false;",
        "              if (layer.id.startsWith('population-estimates-county-')) {\n                return populationVisible;\n              }\n              if (layer.id.startsWith('county-business-patterns-')) {\n                return countyBusinessPatternsVisible;\n              }\n              return false;",
        "CBP visible layer filtering",
    )
    text = replace_once(
        text,
        "    this.populationEstimatesChoropleth$\n      .pipe(takeUntilDestroyed(this.destroyRef))\n      .subscribe((choropleth) => {\n        this.pendingPopulationEstimates = choropleth;\n        this.renderPopulationEstimates();\n      });\n\n    combineLatest([",
        "    this.populationEstimatesChoropleth$\n      .pipe(takeUntilDestroyed(this.destroyRef))\n      .subscribe((choropleth) => {\n        this.pendingPopulationEstimates = choropleth;\n        this.renderPopulationEstimates();\n      });\n\n    this.countyBusinessPatternsChoropleth$\n      .pipe(takeUntilDestroyed(this.destroyRef))\n      .subscribe((choropleth) => {\n        this.pendingCountyBusinessPatterns = choropleth;\n        this.renderCountyBusinessPatterns();\n      });\n\n    combineLatest([\n      this.countyBusinessPatternsMeasure$,\n      this.countyBusinessPatternsIndustry$,\n      this.countyBusinessPatternsYear$,\n    ])\n      .pipe(takeUntilDestroyed(this.destroyRef))\n      .subscribe(([measure, industry, year]) => {\n        this.countyBusinessPatternsMeasure = measure;\n        this.countyBusinessPatternsIndustry = industry;\n        this.countyBusinessPatternsYear = year;\n      });\n\n    combineLatest([",
        "CBP overlay subscriptions",
    )
    text = replace_once(
        text,
        "      this.populationVisible$,\n      this.researchCoverageVisible$,",
        "      this.populationVisible$,\n      this.countyBusinessPatternsVisible$,\n      this.researchCoverageVisible$,",
        "CBP visibility subscription input",
    )
    text = replace_once(
        text,
        "          populationVisible,\n          researchCoverageVisible,\n        ]) => {",
        "          populationVisible,\n          countyBusinessPatternsVisible,\n          researchCoverageVisible,\n        ]) => {",
        "CBP visibility subscription destructuring",
    )
    text = replace_once(
        text,
        "          this.populationVisible = populationVisible;\n          this.researchCoverageVisible = researchCoverageVisible;",
        "          this.populationVisible = populationVisible;\n          this.countyBusinessPatternsVisible = countyBusinessPatternsVisible;\n          this.researchCoverageVisible = researchCoverageVisible;",
        "CBP visibility local state",
    )

    controls = """  protected toggleCountyBusinessPatternsLayer(visible: boolean): void {
    this.store.dispatch(
      MapsActions.countyBusinessPatternsLayerToggled({ visible }),
    );
    this.updateMapUrl({ countyBusinessPatternsVisible: visible });
  }

  protected changeCountyBusinessPatternsMeasure(value: string): void {
    const measure = this.toCountyBusinessPatternsMeasure(value);
    if (!measure) {
      return;
    }

    this.store.dispatch(
      MapsActions.countyBusinessPatternsConfigurationChanged({
        measure,
        industry: this.countyBusinessPatternsIndustry,
        year: this.countyBusinessPatternsYear,
      }),
    );
    this.updateMapUrl({ countyBusinessPatternsMeasure: measure });
  }

  protected changeCountyBusinessPatternsIndustry(value: string): void {
    const industry = this.toCountyBusinessPatternsIndustry(value);
    if (!industry) {
      return;
    }

    this.store.dispatch(
      MapsActions.countyBusinessPatternsConfigurationChanged({
        measure: this.countyBusinessPatternsMeasure,
        industry,
        year: this.countyBusinessPatternsYear,
      }),
    );
    this.updateMapUrl({ countyBusinessPatternsIndustry: industry });
  }

  protected changeCountyBusinessPatternsYear(value: string): void {
    const year = this.toCountyBusinessPatternsYear(value);
    if (year === null) {
      return;
    }

    this.store.dispatch(
      MapsActions.countyBusinessPatternsConfigurationChanged({
        measure: this.countyBusinessPatternsMeasure,
        industry: this.countyBusinessPatternsIndustry,
        year,
      }),
    );
    this.updateMapUrl({ countyBusinessPatternsYear: year });
  }

"""
    text = replace_once(
        text,
        "  protected toggleResearchCoverageLayer(visible: boolean): void {",
        controls + "  protected toggleResearchCoverageLayer(visible: boolean): void {",
        "CBP controls",
    )
    text = replace_once(
        text,
        "          populationYear: this.toPopulationYear(params.get('populationYear')),\n          researchCoverageVisible:",
        "          populationYear: this.toPopulationYear(params.get('populationYear')),\n          countyBusinessPatternsVisible: this.toVisibleState(\n            params.get('countyBusinessPatterns'),\n          ),\n          countyBusinessPatternsMeasure: this.toCountyBusinessPatternsMeasure(\n            params.get('countyBusinessPatternsMeasure'),\n          ),\n          countyBusinessPatternsIndustry: this.toCountyBusinessPatternsIndustry(\n            params.get('countyBusinessPatternsIndustry'),\n          ),\n          countyBusinessPatternsYear: this.toCountyBusinessPatternsYear(\n            params.get('countyBusinessPatternsYear'),\n          ),\n          researchCoverageVisible:",
        "CBP URL model",
    )
    text = replace_once(
        text,
        "            previous.populationYear === current.populationYear &&\n            previous.researchCoverageVisible ===",
        "            previous.populationYear === current.populationYear &&\n            previous.countyBusinessPatternsVisible ===\n              current.countyBusinessPatternsVisible &&\n            previous.countyBusinessPatternsMeasure ===\n              current.countyBusinessPatternsMeasure &&\n            previous.countyBusinessPatternsIndustry ===\n              current.countyBusinessPatternsIndustry &&\n            previous.countyBusinessPatternsYear ===\n              current.countyBusinessPatternsYear &&\n            previous.researchCoverageVisible ===",
        "CBP URL comparison",
    )
    text = replace_once(
        text,
        "          populationYear,\n          researchCoverageVisible,",
        "          populationYear,\n          countyBusinessPatternsVisible,\n          countyBusinessPatternsMeasure,\n          countyBusinessPatternsIndustry,\n          countyBusinessPatternsYear,\n          researchCoverageVisible,",
        "CBP URL destructuring",
    )

    restore = """          if (countyBusinessPatternsVisible !== null) {
            this.store.dispatch(
              MapsActions.countyBusinessPatternsLayerToggled({
                visible: countyBusinessPatternsVisible,
              }),
            );
          }

          if (
            countyBusinessPatternsMeasure !== null ||
            countyBusinessPatternsIndustry !== null ||
            countyBusinessPatternsYear !== null
          ) {
            this.store.dispatch(
              MapsActions.countyBusinessPatternsConfigurationChanged({
                measure:
                  countyBusinessPatternsMeasure ??
                  this.countyBusinessPatternsMeasure,
                industry:
                  countyBusinessPatternsIndustry ??
                  this.countyBusinessPatternsIndustry,
                year:
                  countyBusinessPatternsYear ?? this.countyBusinessPatternsYear,
              }),
            );
          }

"""
    text = replace_once(
        text,
        "          if (researchCoverageVisible !== null) {",
        restore + "          if (researchCoverageVisible !== null) {",
        "CBP URL restoration",
    )
    text = replace_once(
        text,
        "    populationYear?: number;\n    researchCoverageVisible?: boolean;",
        "    populationYear?: number;\n    countyBusinessPatternsVisible?: boolean;\n    countyBusinessPatternsMeasure?: CountyBusinessPatternsMeasure;\n    countyBusinessPatternsIndustry?: CountyBusinessPatternsIndustry;\n    countyBusinessPatternsYear?: number;\n    researchCoverageVisible?: boolean;",
        "CBP URL options",
    )
    text = replace_once(
        text,
        "    if (options.populationYear !== undefined) {\n      queryParams['populationYear'] = options.populationYear;\n    }\n\n    if (options.researchCoverageVisible !== undefined) {",
        "    if (options.populationYear !== undefined) {\n      queryParams['populationYear'] = options.populationYear;\n    }\n\n    if (options.countyBusinessPatternsVisible !== undefined) {\n      queryParams['countyBusinessPatterns'] = options.countyBusinessPatternsVisible\n        ? 'on'\n        : 'off';\n    }\n\n    if (options.countyBusinessPatternsMeasure !== undefined) {\n      queryParams['countyBusinessPatternsMeasure'] =\n        options.countyBusinessPatternsMeasure;\n    }\n\n    if (options.countyBusinessPatternsIndustry !== undefined) {\n      queryParams['countyBusinessPatternsIndustry'] =\n        options.countyBusinessPatternsIndustry;\n    }\n\n    if (options.countyBusinessPatternsYear !== undefined) {\n      queryParams['countyBusinessPatternsYear'] =\n        options.countyBusinessPatternsYear;\n    }\n\n    if (options.researchCoverageVisible !== undefined) {",
        "CBP URL params",
    )

    parsers = """  private toCountyBusinessPatternsMeasure(
    value: string | null,
  ): CountyBusinessPatternsMeasure | null {
    if (
      value === 'ESTABLISHMENTS' ||
      value === 'EMPLOYMENT' ||
      value === 'FIRST_QUARTER_PAYROLL' ||
      value === 'ANNUAL_PAYROLL'
    ) {
      return value;
    }

    return null;
  }

  private toCountyBusinessPatternsIndustry(
    value: string | null,
  ): CountyBusinessPatternsIndustry | null {
    return this.countyBusinessPatternsIndustries.some(
      (industry) => industry.code === value,
    )
      ? (value as CountyBusinessPatternsIndustry)
      : null;
  }

  private toCountyBusinessPatternsYear(value: string | null): number | null {
    const parsed = Number(value);
    return parsed === 2023 ? 2023 : null;
  }

"""
    text = replace_once(
        text,
        "  private isOverlayStale(staleAfter: string): boolean {",
        parsers + "  private isOverlayStale(staleAfter: string): boolean {",
        "CBP URL parsers",
    )
    text = replace_once(
        text,
        "    this.renderSaipeChoropleth();\n    this.renderPopulationEstimates();\n    this.renderResearchCoverage();",
        "    this.renderSaipeChoropleth();\n    this.renderPopulationEstimates();\n    this.renderCountyBusinessPatterns();\n    this.renderResearchCoverage();",
        "CBP sync rendering",
    )

    renderer = """  private renderCountyBusinessPatterns(): void {
    if (
      !this.map ||
      !this.mapStyleReady ||
      !this.pendingCountyBusinessPatterns
    ) {
      return;
    }

    const overlay = this.pendingCountyBusinessPatterns;
    const data = overlay.geoJson as GeoJsonFeatureCollection;
    const scale = buildCountyBusinessPatternsScale(overlay);
    const sourceId = 'county-business-patterns-county';
    const fillId = 'county-business-patterns-county-fill';
    const outlineId = 'county-business-patterns-county-outline';
    const existingSource = this.map.getSource(sourceId) as GeoJSONSource | null;

    if (existingSource) {
      existingSource.setData(data);
      if (this.map.getLayer(fillId)) {
        this.map.setPaintProperty(fillId, 'fill-color', scale.fillColor);
      }
      this.applyLayerVisibility();
      return;
    }

    this.map.addSource(sourceId, { type: 'geojson', data });
    this.map.addLayer(
      {
        id: fillId,
        type: 'fill',
        source: sourceId,
        layout: {
          visibility: this.countyBusinessPatternsVisible ? 'visible' : 'none',
        },
        paint: {
          'fill-color': scale.fillColor,
          'fill-opacity': 0.72,
        },
      },
      'census-area-fill',
    );
    this.map.addLayer({
      id: outlineId,
      type: 'line',
      source: sourceId,
      layout: {
        visibility: this.countyBusinessPatternsVisible ? 'visible' : 'none',
      },
      paint: {
        'line-color': '#065f46',
        'line-width': 1.25,
      },
    });

    this.applyLayerVisibility();
  }

"""
    text = replace_once(
        text,
        "  /**\n   * Draws the current viewport's bounded publisher spatial evidence.",
        renderer + "  /**\n   * Draws the current viewport's bounded publisher spatial evidence.",
        "CBP renderer",
    )
    text = replace_once(
        text,
        "      population: this.populationVisible,\n      research: this.researchCoverageVisible,",
        "      population: this.populationVisible,\n      cbp: this.countyBusinessPatternsVisible,\n      research: this.researchCoverageVisible,",
        "CBP debug state",
    )

    path.write_text(text)


def patch_maps_page_utils() -> None:
    path = Path("apps/discovery-ui/src/app/pages/maps-page.utils.ts")
    text = path.read_text()
    text = replace_once(
        text,
        "  | 'population'\n  | 'research'",
        "  | 'population'\n  | 'cbp'\n  | 'research'",
        "CBP group id",
    )
    population_group = """  {
    id: 'population',
    label: 'County population',
    sourceId: 'population-estimates-county',
    layerIds: [
      'population-estimates-county-fill',
      'population-estimates-county-outline',
    ],
  },
"""
    cbp_group = population_group + """  {
    id: 'cbp',
    label: 'County Business Patterns',
    sourceId: 'county-business-patterns-county',
    layerIds: [
      'county-business-patterns-county-fill',
      'county-business-patterns-county-outline',
    ],
  },
"""
    text = replace_once(text, population_group, cbp_group, "CBP map group")
    path.write_text(text)


def patch_maps_page_html() -> None:
    path = Path("apps/discovery-ui/src/app/pages/maps-page.html")
    html = path.read_text()
    html = replace_once(
        html,
        "                ((populationAvailable$ | async) ? 1 : 0) }} layers",
        "                ((populationAvailable$ | async) ? 1 : 0) +\n                ((countyBusinessPatternsAvailable$ | async) ? 1 : 0) }} layers",
        "CBP category count",
    )

    community_end = """          </div>
        </details>

        <details
          class="layer-category"
          data-testid="map-layer-category-environment-hazards"
        >
"""
    controls = """            @if (countyBusinessPatternsAvailable$ | async) {
            <div class="layer-config-group">
              <span class="layer-toggle-row">
                <label class="layer-toggle">
                  <input
                    type="checkbox"
                    data-testid="map-layer-county-business-patterns"
                    [checked]="countyBusinessPatternsVisible$ | async"
                    (change)="
                      toggleCountyBusinessPatternsLayer(
                        $any($event.target).checked
                      )
                    "
                  />
                  <span class="layer-toggle-label">County Business Patterns</span>
                </label>
                <button
                  type="button"
                  class="layer-info-button"
                  mat-icon-button
                  data-testid="map-layer-county-business-patterns-info"
                  [matTooltip]="layerTooltips.cbp"
                  matTooltipPosition="above"
                  aria-label="About County Business Patterns layer"
                >
                  <mat-icon aria-hidden="true">info_outline</mat-icon>
                </button>
              </span>

              @if (countyBusinessPatternsVisible$ | async) {
              @if (countyBusinessPatternsMeasure$ | async; as cbpMeasure) {
              @if (countyBusinessPatternsIndustry$ | async; as cbpIndustry) {
              @if (countyBusinessPatternsYear$ | async; as cbpYear) {
              <div
                class="population-config"
                data-testid="county-business-patterns-config"
              >
                <label>
                  Measure
                  <select
                    #cbpMeasureSelect
                    data-testid="county-business-patterns-measure"
                    [value]="cbpMeasure"
                    (change)="
                      changeCountyBusinessPatternsMeasure(cbpMeasureSelect.value)
                    "
                  >
                    <option value="ESTABLISHMENTS">Establishments</option>
                    <option value="EMPLOYMENT">Employment</option>
                    <option value="FIRST_QUARTER_PAYROLL">
                      First-quarter payroll
                    </option>
                    <option value="ANNUAL_PAYROLL">Annual payroll</option>
                  </select>
                </label>

                <label>
                  Industry
                  <select
                    #cbpIndustrySelect
                    data-testid="county-business-patterns-industry"
                    [value]="cbpIndustry"
                    (change)="
                      changeCountyBusinessPatternsIndustry(
                        cbpIndustrySelect.value
                      )
                    "
                  >
                    @for (
                      industry of countyBusinessPatternsIndustries;
                      track industry.code
                    ) {
                    <option [value]="industry.code">
                      {{ industry.label }}
                    </option>
                    }
                  </select>
                </label>

                <label>
                  Year
                  <select
                    #cbpYearSelect
                    data-testid="county-business-patterns-year"
                    [value]="cbpYear"
                    (change)="
                      changeCountyBusinessPatternsYear(cbpYearSelect.value)
                    "
                  >
                    @for (year of countyBusinessPatternsYears; track year) {
                    <option [value]="year">{{ year }}</option>
                    }
                  </select>
                </label>

                @if (countyBusinessPatternsLoading$ | async) {
                <span class="feature-hint population-config-status" role="status">
                  Updating County Business Patterns…
                </span>
                }
              </div>
              } } } }
            </div>
            }
          </div>
        </details>

        <details
          class="layer-category"
          data-testid="map-layer-category-environment-hazards"
        >
"""
    html = replace_once(html, community_end, controls, "CBP controls")

    legend_anchor = """          } } @if (researchCoverageVisible$ | async) { @if
          (researchCoverageSummary$ | async; as researchCoverage) {
"""
    legend = """          } } @if (countyBusinessPatternsVisible$ | async) { @if (
          countyBusinessPatternsChoropleth$ | async; as cbp ) { @if
          (countyBusinessPatternsScale$ | async; as cbpScale) {
          <li class="population-legend-entry">
            <span class="swatch" [style.background-color]="'#059669'"></span>
            <div class="population-legend-body">
              <strong>County Business Patterns — {{ cbp.measureLabel }}</strong>
              <span>
                {{ cbp.industryLabel }} · {{ cbp.year }} · {{ cbp.units }}
              </span>
              <div
                class="population-breaks"
                aria-label="County Business Patterns color scale"
              >
                @for (cbpBreak of cbpScale.breaks; track cbpBreak.label) {
                <span class="population-break">
                  <span
                    class="swatch population-break-swatch"
                    [style.background-color]="cbpBreak.color"
                  ></span>
                  {{ cbpBreak.label }}
                </span>
                }
              </div>
              <span class="population-legend-note">
                {{ cbpScale.description }}
              </span>
            </div>
          </li>
          } } @else if (countyBusinessPatternsError$ | async) {
          <li>
            <span class="swatch" [style.background-color]="'#059669'"></span>
            County Business Patterns unavailable
          </li>
          } } @if (researchCoverageVisible$ | async) { @if
          (researchCoverageSummary$ | async; as researchCoverage) {
"""
    html = replace_once(html, legend_anchor, legend, "CBP legend")

    summary_anchor = """      } @if (saipeVisible$ | async) { @if (saipeChoropleth$ | async; as saipe) {
"""
    summary = """      } @if (countyBusinessPatternsVisible$ | async) {
      <li>
        <app-county-business-patterns-summary
          [choropleth]="
            (countyBusinessPatternsChoropleth$ | async) ?? null
          "
          [loading]="(countyBusinessPatternsLoading$ | async) ?? false"
          [error]="(countyBusinessPatternsError$ | async) ?? null"
        />
      </li>
      } @if (saipeVisible$ | async) { @if (saipeChoropleth$ | async; as saipe) {
"""
    html = replace_once(html, summary_anchor, summary, "CBP semantic summary")
    path.write_text(html)


patch_maps_page_ts()
patch_maps_page_utils()
patch_maps_page_html()
print("CBP Maps page integration patched successfully.")
