import { readFileSync, writeFileSync } from 'node:fs';

function replaceOnce(text, needle, replacement, label) {
  const index = text.indexOf(needle);
  if (index < 0) {
    throw new Error(`Missing patch target: ${label}`);
  }
  if (text.indexOf(needle, index + needle.length) >= 0) {
    throw new Error(`Patch target is not unique: ${label}`);
  }
  return text.slice(0, index) + replacement + text.slice(index + needle.length);
}

function replaceRegex(text, regex, replacement, label) {
  let count = 0;
  const next = text.replace(regex, () => {
    count += 1;
    return replacement;
  });
  if (count !== 1) {
    throw new Error(`Expected one regex patch target for ${label}; found ${count}`);
  }
  return next;
}

const tsPath = 'apps/discovery-ui/src/app/pages/maps-page.ts';
let ts = readFileSync(tsPath, 'utf8');

ts = replaceOnce(
  ts,
  `  MapLayer,\n  ResearchObjectType,\n  SaipeCountyChoropleth,`,
  `  MapLayer,\n  ResearchObjectType,\n  ResearchSpatialCoverageFeature,\n  ResearchSpatialViewport,\n  SaipeCountyChoropleth,`,
  'research spatial type imports',
);

ts = replaceOnce(
  ts,
  `  selectResearchCoverageError,\n  selectResearchCoverageSummary,`,
  `  selectResearchCoverageError,\n  selectResearchCoverageLoading,\n  selectResearchCoverageSummary,`,
  'research loading selector import',
);

ts = replaceRegex(
  ts,
  /type ResearchCoverageFeatureCollection = \{[\s\S]*?\n\};\n\n@Component/,
  `type ResearchCoverageFeatureCollection = {\n  type: 'FeatureCollection';\n  features: {\n    type: 'Feature';\n    properties: {\n      sourceIdentifier: string;\n      title: string;\n      publisher: string | null;\n      program: string | null;\n      contentType: string | null;\n      sourceUrl: string | null;\n      geometryStatus: string;\n      renderPointMethod: string | null;\n      mapRendering: 'PUBLISHER_GEOMETRY' | 'ANTIMERIDIAN_ANCHOR';\n    };\n    geometry: unknown;\n  }[];\n};\n\n@Component`,
  'research feature collection type',
);

ts = replaceOnce(
  ts,
  `  private researchCoverageCriteria: SearchQuery = { page: 0, pageSize: 1 };\n  private researchCoverageFingerprint = '';\n`,
  `  private researchCoverageCriteria: SearchQuery = {};\n  private researchCoverageCriteriaFingerprint = '';\n  private researchCoverageRequestFingerprint = '';\n`,
  'research criteria fields',
);

ts = replaceOnce(
  ts,
  `  private panAreaSyncTimer: ReturnType<typeof setTimeout> | null = null;\n`,
  `  private panAreaSyncTimer: ReturnType<typeof setTimeout> | null = null;\n  private researchCoverageRefreshTimer: ReturnType<typeof setTimeout> | null = null;\n`,
  'research refresh timer',
);

ts = replaceOnce(
  ts,
  `    research:\n      'Shows matching research-object counts only where retained metadata explicitly names a supported Census area. Records without explicit research geography are counted as not mapped; publisher or institution locations are never substituted.',`,
  `    research:\n      'Shows bounded Data.gov research coverage from publisher-supplied spatial geometry retained in the active spatial sidecar. The map never substitutes publisher, laboratory, author, or institution addresses for missing research geometry.',`,
  'research tooltip',
);

ts = replaceOnce(
  ts,
  `  protected readonly researchCoverageSummary$ = this.store.select(\n    selectResearchCoverageSummary,\n  );\n  protected readonly researchCoverageError$ = this.store.select(\n`,
  `  protected readonly researchCoverageSummary$ = this.store.select(\n    selectResearchCoverageSummary,\n  );\n  protected readonly researchCoverageLoading$ = this.store.select(\n    selectResearchCoverageLoading,\n  );\n  protected readonly researchCoverageError$ = this.store.select(\n`,
  'research loading observable',
);

ts = replaceOnce(
  ts,
  `    this.researchCoverageSummary$\n      .pipe(takeUntilDestroyed(this.destroyRef))\n      .subscribe((summary) => {\n        this.pendingResearchCoverage = summary;\n        this.renderResearchCoverage();\n      });`,
  `    this.researchCoverageSummary$\n      .pipe(takeUntilDestroyed(this.destroyRef))\n      .subscribe((summary) => {\n        this.pendingResearchCoverage = summary;\n        if (summary) {\n          this.renderResearchCoverage();\n        } else {\n          this.clearResearchCoverageGeometry();\n        }\n      });`,
  'research summary subscription',
);

ts = replaceOnce(
  ts,
  `  private schedulePanAreaSync(): void {\n    if (this.panAreaSyncTimer !== null) {\n      clearTimeout(this.panAreaSyncTimer);\n    }\n\n    this.panAreaSyncTimer = setTimeout(() => {\n      this.panAreaSyncTimer = null;\n      this.syncCensusAreaFromMapCenter();\n    }, 300);\n  }\n\n  private bindPanAreaSync(): void {`,
  `  private schedulePanAreaSync(): void {\n    if (this.panAreaSyncTimer !== null) {\n      clearTimeout(this.panAreaSyncTimer);\n    }\n\n    this.panAreaSyncTimer = setTimeout(() => {\n      this.panAreaSyncTimer = null;\n      this.syncCensusAreaFromMapCenter();\n    }, 300);\n  }\n\n  private scheduleResearchCoverageRefresh(delay = 250): void {\n    if (this.researchCoverageRefreshTimer !== null) {\n      clearTimeout(this.researchCoverageRefreshTimer);\n    }\n\n    this.researchCoverageRefreshTimer = setTimeout(() => {\n      this.researchCoverageRefreshTimer = null;\n      this.requestResearchCoverageForCurrentViewport();\n    }, delay);\n  }\n\n  private currentResearchViewport(): ResearchSpatialViewport | null {\n    if (!this.map) {\n      return null;\n    }\n\n    const bounds = this.map.getBounds();\n    return {\n      west: this.normalizeLongitude(bounds.getWest()),\n      south: Math.max(-90, Math.min(90, bounds.getSouth())),\n      east: this.normalizeLongitude(bounds.getEast()),\n      north: Math.max(-90, Math.min(90, bounds.getNorth())),\n    };\n  }\n\n  private normalizeLongitude(longitude: number): number {\n    const normalized = ((((longitude + 180) % 360) + 360) % 360) - 180;\n    return normalized === -180 && longitude > 0 ? 180 : normalized;\n  }\n\n  private requestResearchCoverageForCurrentViewport(): void {\n    const viewport = this.currentResearchViewport();\n    if (!viewport) {\n      return;\n    }\n\n    const viewportKey = [viewport.west, viewport.south, viewport.east, viewport.north]\n      .map((value) => value.toFixed(5))\n      .join(',');\n    const fingerprint = `${this.researchCoverageCriteriaFingerprint}|${viewportKey}`;\n    if (fingerprint === this.researchCoverageRequestFingerprint) {\n      return;\n    }\n\n    this.researchCoverageRequestFingerprint = fingerprint;\n    this.store.dispatch(\n      MapsActions.researchCoverageRequested({\n        query: this.researchCoverageCriteria,\n        viewport,\n      }),\n    );\n  }\n\n  private bindPanAreaSync(): void {`,
  'research viewport scheduling helpers',
);

ts = replaceOnce(
  ts,
  `    const onMoveEnd = (): void => {\n      if (this.skipPanAreaSync) {\n        this.skipPanAreaSync = false;\n        return;\n      }\n\n      this.schedulePanAreaSync();\n    };`,
  `    const onMoveEnd = (): void => {\n      if (this.skipPanAreaSync) {\n        this.skipPanAreaSync = false;\n      } else {\n        this.schedulePanAreaSync();\n      }\n\n      this.scheduleResearchCoverageRefresh();\n    };`,
  'moveend research refresh',
);

ts = replaceOnce(
  ts,
  `      if (this.panAreaSyncTimer !== null) {\n        clearTimeout(this.panAreaSyncTimer);\n      }\n\n      this.map?.off('moveend', onMoveEnd);`,
  `      if (this.panAreaSyncTimer !== null) {\n        clearTimeout(this.panAreaSyncTimer);\n      }\n      if (this.researchCoverageRefreshTimer !== null) {\n        clearTimeout(this.researchCoverageRefreshTimer);\n      }\n\n      this.map?.off('moveend', onMoveEnd);`,
  'destroy research refresh timer',
);

ts = replaceOnce(
  ts,
  `    onZoomChanged();\n    this.destroyRef.onDestroy(() => {`,
  `    onZoomChanged();\n    this.scheduleResearchCoverageRefresh(0);\n    this.destroyRef.onDestroy(() => {`,
  'initial research viewport request',
);

ts = replaceRegex(
  ts,
  /        const query: SearchQuery = \{[\s\S]*?\n        \};\n\n        this\.researchCoverageCriteria = query;\n        const fingerprint = JSON\.stringify\(query\);\n        if \(fingerprint !== this\.researchCoverageFingerprint\) \{\n          this\.researchCoverageFingerprint = fingerprint;\n          this\.store\.dispatch\(MapsActions\.researchCoverageRequested\(\{ query \}\)\);\n        \}/,
  `        const query: SearchQuery = {\n          q,\n          ...(programs.length ? { programs } : {}),\n          ...(publisher ? { publisher } : {}),\n          ...(sourceSystem\n            ? { sourceSystem: sourceSystem as SourceSystem }\n            : {}),\n          ...(geography ? { geography } : {}),\n          ...(contentType\n            ? { contentType: contentType as ResearchObjectType }\n            : {}),\n          ...(vintageYear !== null ? { vintageYear } : {}),\n        };\n\n        this.researchCoverageCriteria = query;\n        const fingerprint = JSON.stringify(query);\n        if (fingerprint !== this.researchCoverageCriteriaFingerprint) {\n          this.researchCoverageCriteriaFingerprint = fingerprint;\n          this.researchCoverageRequestFingerprint = '';\n          this.scheduleResearchCoverageRefresh(0);\n        }`,
  'research context dispatch',
);

ts = replaceRegex(
  ts,
  /\n  protected researchAreaSearchParams\([\s\S]*?\n  \}\n\n  private bindUrlState/,
  `\n  private bindUrlState`,
  'obsolete research-area search params',
);

ts = replaceRegex(
  ts,
  /  \/\*\*[\s\S]*?Bounded repository research-by-area summary\.[\s\S]*?\n  private renderResearchCoverage\(\): void \{[\s\S]*?\n    this\.applyLayerVisibility\(\);\n  \}\n\n  private renderHydrographyLayer/,
  `  /**\n   * Draws the current viewport's bounded publisher spatial evidence.\n   *\n   * Ordinary rows use the publisher GeoJSON retained by the versioned sidecar. Antimeridian\n   * candidates use the explicit source-derived render anchor instead of drawing a naive envelope\n   * across the world. The semantic table exposes the same bounded feature list and rendering mode.\n   */\n  private renderResearchCoverage(): void {\n    if (!this.map || !this.mapStyleReady || !this.pendingResearchCoverage) {\n      return;\n    }\n\n    const data = this.createResearchCoverageGeoJson(this.pendingResearchCoverage);\n    const existingSource = this.map.getSource(\n      'repository-research-coverage',\n    ) as GeoJSONSource | null;\n\n    if (existingSource) {\n      existingSource.setData(data);\n      this.applyLayerVisibility();\n      return;\n    }\n\n    this.map.addSource('repository-research-coverage', {\n      type: 'geojson',\n      data,\n    });\n\n    this.map.addLayer({\n      id: 'repository-research-coverage-fill',\n      type: 'fill',\n      source: 'repository-research-coverage',\n      filter: ['==', ['geometry-type'], 'Polygon'],\n      layout: {\n        visibility: this.researchCoverageVisible ? 'visible' : 'none',\n      },\n      paint: {\n        'fill-color': '#0f766e',\n        'fill-opacity': 0.28,\n      },\n    });\n\n    this.map.addLayer({\n      id: 'repository-research-coverage-line',\n      type: 'line',\n      source: 'repository-research-coverage',\n      filter: [\n        'any',\n        ['==', ['geometry-type'], 'LineString'],\n        ['==', ['geometry-type'], 'Polygon'],\n      ],\n      layout: {\n        visibility: this.researchCoverageVisible ? 'visible' : 'none',\n      },\n      paint: {\n        'line-color': '#115e59',\n        'line-width': 2.5,\n        'line-opacity': 0.9,\n      },\n    });\n\n    this.map.addLayer({\n      id: 'repository-research-coverage-points',\n      type: 'circle',\n      source: 'repository-research-coverage',\n      filter: ['==', ['geometry-type'], 'Point'],\n      layout: {\n        visibility: this.researchCoverageVisible ? 'visible' : 'none',\n      },\n      paint: {\n        'circle-color': '#0f766e',\n        'circle-opacity': 0.82,\n        'circle-radius': 7,\n        'circle-stroke-color': '#ffffff',\n        'circle-stroke-width': 2,\n      },\n    });\n\n    this.applyLayerVisibility();\n  }\n\n  private clearResearchCoverageGeometry(): void {\n    if (!this.map || !this.mapStyleReady) {\n      return;\n    }\n\n    const source = this.map.getSource(\n      'repository-research-coverage',\n    ) as GeoJSONSource | null;\n    source?.setData({ type: 'FeatureCollection', features: [] });\n  }\n\n  private renderHydrographyLayer`,
  'research geometry renderer',
);

ts = replaceRegex(
  ts,
  /  private createResearchCoverageGeoJson\([\s\S]*?\n  \}\n\n  private createEarthquakeGeoJson/,
  `  private createResearchCoverageGeoJson(\n    summary: ResearchCoverageSummary,\n  ): ResearchCoverageFeatureCollection {\n    return {\n      type: 'FeatureCollection',\n      features: summary.features.map((feature) => ({\n        type: 'Feature',\n        properties: {\n          sourceIdentifier: feature.sourceIdentifier,\n          title: feature.title,\n          publisher: feature.publisher ?? null,\n          program: feature.program ?? null,\n          contentType: feature.contentType ?? null,\n          sourceUrl: feature.sourceUrl ?? null,\n          geometryStatus: feature.geometryStatus,\n          renderPointMethod: feature.renderPointMethod ?? null,\n          mapRendering:\n            feature.geometryStatus === 'ANTIMERIDIAN_CANDIDATE'\n              ? 'ANTIMERIDIAN_ANCHOR'\n              : 'PUBLISHER_GEOMETRY',\n        },\n        geometry: this.researchCoverageMapGeometry(feature),\n      })),\n    };\n  }\n\n  private researchCoverageMapGeometry(\n    feature: ResearchSpatialCoverageFeature,\n  ): unknown {\n    if (\n      feature.geometryStatus === 'ANTIMERIDIAN_CANDIDATE' &&\n      feature.renderLon !== null &&\n      feature.renderLon !== undefined &&\n      feature.renderLat !== null &&\n      feature.renderLat !== undefined\n    ) {\n      return {\n        type: 'Point',\n        coordinates: [feature.renderLon, feature.renderLat],\n      };\n    }\n\n    return feature.geometry;\n  }\n\n  private createEarthquakeGeoJson`,
  'research feature collection builder',
);

writeFileSync(tsPath, ts);

const utilsPath = 'apps/discovery-ui/src/app/pages/maps-page.utils.ts';
let utils = readFileSync(utilsPath, 'utf8');
utils = replaceOnce(
  utils,
  `    label: 'Repository research by area',\n    sourceId: 'repository-research-coverage',\n    layerIds: [\n      'repository-research-coverage-circles',\n      'repository-research-coverage-labels',\n    ],`,
  `    label: 'Data.gov publisher research geometry',\n    sourceId: 'repository-research-coverage',\n    layerIds: [\n      'repository-research-coverage-fill',\n      'repository-research-coverage-line',\n      'repository-research-coverage-points',\n    ],`,
  'map research debug group',
);
writeFileSync(utilsPath, utils);

const htmlPath = 'apps/discovery-ui/src/app/pages/maps-page.html';
let html = readFileSync(htmlPath, 'utf8');

html = replaceRegex(
  html,
  /        @if \(researchCoverageSummary\$ \| async; as researchCoverage\) \{\n        <details[\s\S]*?data-testid="map-layer-category-research-coverage"[\s\S]*?<\/details>\n        \}/,
  `        <details\n          class="layer-category"\n          data-testid="map-layer-category-research-coverage"\n          open\n        >\n          <summary data-testid="map-layer-category-research-coverage-summary">\n            <span class="layer-category-summary-content">\n              <span class="layer-category-title">Research Coverage</span>\n              <span class="layer-category-count">1 layer</span>\n            </span>\n          </summary>\n\n          <div class="layer-category-items">\n            <span class="layer-toggle-row">\n              <label class="layer-toggle">\n                <input\n                  type="checkbox"\n                  data-testid="map-layer-research-coverage"\n                  [checked]="researchCoverageVisible$ | async"\n                  (change)="toggleResearchCoverageLayer($any($event.target).checked)"\n                />\n                <span class="layer-toggle-label">Data.gov publisher research geometry</span>\n              </label>\n              <button\n                type="button"\n                class="layer-info-button"\n                mat-icon-button\n                data-testid="map-layer-research-coverage-info"\n                [matTooltip]="layerTooltips.research"\n                matTooltipPosition="above"\n                aria-label="About Data.gov publisher research geometry layer"\n              >\n                <mat-icon aria-hidden="true">info_outline</mat-icon>\n              </button>\n            </span>\n            @if (researchCoverageLoading$ | async) {\n            <span class="feature-hint" role="status">Updating research coverage for the current viewport…</span>\n            }\n          </div>\n        </details>`,
  'always-visible research category',
);

html = replaceOnce(
  html,
  `            context where retained for the selected area and repository research\n            coverage where records explicitly name a supported Census area`,
  `            context where retained for the selected area and Data.gov research\n            coverage from publisher-supplied spatial geometry in the active sidecar`,
  'research context copy',
);

html = replaceRegex(
  html,
  /          \} \} @if \(researchCoverageVisible\$ \| async\) \{ @if\n          \(researchCoverageSummary\$ \| async; as researchCoverage\) \{\n          <li>[\s\S]*?<\/li>\n          \} \} @if \(hydrographyVisible\$ \| async\) \{/,
  `          } } @if (researchCoverageVisible$ | async) { @if\n          (researchCoverageSummary$ | async; as researchCoverage) {\n          <li>\n            <span class="swatch research"></span>\n            Data.gov publisher research geometry ({{\n            researchCoverage.viewportMappedResults | number }} mapped in view; {{\n            researchCoverage.returnedFeatures | number }} returned of {{\n            researchCoverage.totalResults | number }} matching) @if\n            (researchCoverage.truncated) {\n            <span class="status-pill stale">bounded to {{ researchCoverage.featureLimit | number }} features</span>\n            }\n          </li>\n          } } @if (hydrographyVisible$ | async) {`,
  'research legend',
);

html = replaceRegex(
  html,
  /    \} \} \} @if \(researchCoverageVisible\$ \| async\) \{ @if\n      \(researchCoverageSummary\$ \| async; as researchCoverage\) \{\n      <li>[\s\S]*?\n      <\/li>\n      \} \} @if \(saipeVisible\$ \| async\)/,
  `    } } } @if (researchCoverageVisible$ | async) {\n      <li>\n        <section\n          class="research-coverage-summary"\n          aria-labelledby="research-coverage-summary-heading"\n        >\n          <h3 id="research-coverage-summary-heading">\n            Data.gov publisher research geometry\n          </h3>\n          @if (researchCoverageLoading$ | async) {\n          <p class="feature-hint" role="status">\n            Updating publisher spatial coverage for the current map viewport.\n          </p>\n          } @if (researchCoverageSummary$ | async; as researchCoverage) {\n          <p>\n            {{ researchCoverage.mappedResults | number }} of {{\n            researchCoverage.totalResults | number }} matching Data.gov research objects\n            have publisher spatial geometry. {{ researchCoverage.unmappedResults | number }}\n            have no publisher geometry and {{ researchCoverage.quarantinedResults | number }}\n            have geometry that failed validation. The current viewport contains {{\n            researchCoverage.viewportMappedResults | number }} mapped objects; {{\n            researchCoverage.returnedFeatures | number }} bounded features are returned to the\n            browser. Publisher, laboratory, author, and institution addresses are never\n            substituted for missing research geometry.\n          </p>\n          @if (researchCoverage.unanchoredAntimeridianResults > 0) {\n          <p class="feature-hint">\n            {{ researchCoverage.unanchoredAntimeridianResults | number }} antimeridian candidate\n            geometries lack a safe render anchor and are not mapped.\n          </p>\n          } @if (researchCoverage.truncated) {\n          <p class="feature-hint">\n            {{ researchCoverage.omittedFeatures | number }} additional mapped objects in this\n            viewport are omitted by the {{ researchCoverage.featureLimit | number }}-feature\n            browser safety limit. Pan or zoom to refine the bounded result.\n          </p>\n          }\n          @if (researchCoverage.features.length) {\n          <table class="county-value-table">\n            <caption>\n              Publisher-spatial research objects returned for the current map viewport\n            </caption>\n            <thead>\n              <tr>\n                <th scope="col">Research object</th>\n                <th scope="col">Publisher</th>\n                <th scope="col">Program / type</th>\n                <th scope="col">Geometry</th>\n                <th scope="col">Source</th>\n              </tr>\n            </thead>\n            <tbody>\n              @for (feature of researchCoverage.features; track feature.sourceIdentifier) {\n              <tr>\n                <th scope="row">{{ feature.title }}</th>\n                <td>{{ feature.publisher || 'Not stated' }}</td>\n                <td>\n                  {{ feature.program || 'Not stated' }} / {{ feature.contentType || 'Not stated' }}\n                </td>\n                <td>\n                  @if (feature.geometryStatus === 'ANTIMERIDIAN_CANDIDATE') {\n                  Source-derived render anchor for antimeridian candidate\n                  } @else { Publisher geometry }\n                </td>\n                <td>\n                  @if (feature.sourceUrl) {\n                  <a class="source-link" [href]="feature.sourceUrl">Open source record</a>\n                  } @else { Data.gov source identifier {{ feature.sourceIdentifier }} }\n                </td>\n              </tr>\n              }\n            </tbody>\n          </table>\n          } @else {\n          <p class="feature-hint">\n            No publisher-spatial research objects from this search intersect the current viewport.\n          </p>\n          }\n          <p class="feature-hint">\n            Spatial build {{ researchCoverage.buildId }} · source snapshot {{\n            researchCoverage.sourceSnapshotAt | date: 'medium' }} · projection {{\n            researchCoverage.projectionId }}\n          </p>\n          }\n        </section>\n      </li>\n      } @if (saipeVisible$ | async)`,
  'research semantic summary',
);

writeFileSync(htmlPath, html);
