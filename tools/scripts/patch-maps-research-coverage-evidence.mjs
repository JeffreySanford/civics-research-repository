import { readFileSync, writeFileSync } from 'node:fs';

function replaceOnce(text, needle, replacement, label) {
  const index = text.indexOf(needle);
  if (index < 0) throw new Error(`Missing patch target: ${label}`);
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
  if (count !== 1) throw new Error(`Expected one ${label} target; found ${count}`);
  return next;
}

// NgRx effect evidence.
{
  const path = 'apps/discovery-ui/src/app/state/maps/maps.effects.spec.ts';
  let text = readFileSync(path, 'utf8');
  text = replaceOnce(
    text,
    `  RepositoryMapsApi,\n  RepositorySearchApi,\n  type CensusAreaBoundary,\n  type SearchResponse,\n  type MapLayer,`,
    `  RepositoryMapsApi,\n  type CensusAreaBoundary,\n  type MapLayer,\n  type ResearchSpatialCoverageResponse,\n  type ResearchSpatialViewport,`,
    'effects imports',
  );
  text = replaceRegex(
    text,
    /\nconst searchResponse = \{[\s\S]*?\n\} as unknown as SearchResponse;\n/,
    '\n',
    'obsolete search response fixture',
  );
  text = replaceOnce(
    text,
    `function setup(\n  mapsApi: Partial<RepositoryMapsApi>,\n  actions$: Observable<unknown>,\n  selectedGeography = 'North Dakota',\n  searchApi: Partial<RepositorySearchApi> = {\n    searchResearchObjects: vi.fn().mockReturnValue(of(searchResponse)),\n  },\n) {`,
    `function setup(\n  mapsApi: Partial<RepositoryMapsApi>,\n  actions$: Observable<unknown>,\n  selectedGeography = 'North Dakota',\n) {`,
    'effects setup signature',
  );
  text = replaceOnce(
    text,
    `      { provide: RepositoryMapsApi, useValue: mapsApi },\n      { provide: RepositorySearchApi, useValue: searchApi },`,
    `      { provide: RepositoryMapsApi, useValue: mapsApi },`,
    'search api provider removal',
  );
  text = replaceRegex(
    text,
    /  it\('loads Research Coverage through one bounded search facet request',[\s\S]*?\n  \}\);\n\}\);/,
    `  it('loads Research Coverage through the bounded spatial viewport API', async () => {\n    const response = {\n      buildId: 'spatial-build-42',\n      sourceSystem: 'DATA_GOV',\n      schemaVersion: 1,\n      sourceSnapshotAt: '2026-09-02T12:00:00Z',\n      capturedAt: '2026-09-02T12:05:00Z',\n      compositionSha256: 'a'.repeat(64),\n      projectionId: 'projection-9',\n      criteriaFingerprint: 'criteria-123',\n      viewport: { west: -125, south: 30, east: -110, north: 45 },\n      summary: {\n        matchingRecords: 33,\n        mappedRecords: 30,\n        unmappedRecords: 3,\n        quarantinedRecords: 1,\n        unanchoredAntimeridianRecords: 0,\n        viewportMappedRecords: 2,\n        returnedFeatures: 2,\n        omittedFeatures: 0,\n        featureLimit: 200,\n        truncated: false,\n      },\n      features: [],\n    } as unknown as ResearchSpatialCoverageResponse;\n    const viewport: ResearchSpatialViewport = {\n      west: -125,\n      south: 30,\n      east: -110,\n      north: 45,\n    };\n    const query = {\n      q: 'climate',\n      programs: ['TIGER_LINE', 'LODES'],\n      publisher: 'U.S. Census Bureau',\n      sourceSystem: 'DATA_GOV' as const,\n      contentType: 'DATASET' as const,\n    };\n    const getResearchSpatialCoverage = vi.fn().mockReturnValue(of(response));\n    const effects = setup(\n      { getResearchSpatialCoverage } as unknown as RepositoryMapsApi,\n      of(MapsActions.researchCoverageRequested({ query, viewport })),\n    );\n\n    const emitted = await firstValueFrom(effects.loadResearchCoverage$);\n\n    // The effect owns query/viewport cancellation; RepositoryMapsApi owns the default 200-feature\n    // safety limit. Keeping the default in one place prevents the effect and client from drifting.\n    expect(getResearchSpatialCoverage).toHaveBeenCalledWith(query, viewport);\n    expect(emitted).toEqual(MapsActions.researchCoverageLoaded({ response }));\n  });\n});`,
    'research coverage effect test',
  );
  writeFileSync(path, text);
}

// E2E API fixture for the bounded spatial endpoint.
{
  const path = 'apps/discovery-ui-e2e/src/support/repository-api-mocks.ts';
  let text = readFileSync(path, 'utf8');
  text = replaceOnce(
    text,
    `  await mockRepositoryApiBase(page);\n  await mockCursorSearch(page, 'REPOSITORY');`,
    `  await mockRepositoryApiBase(page);\n  await mockCursorSearch(page, 'REPOSITORY');\n  await mockResearchSpatialCoverage(page);`,
    'repository spatial mock registration',
  );
  text = replaceOnce(
    text,
    `  await mockFixtureBackedRepositoryApiBase(page);\n  await mockCursorSearch(page, 'FIXTURE');`,
    `  await mockFixtureBackedRepositoryApiBase(page);\n  await mockCursorSearch(page, 'FIXTURE');\n  await mockResearchSpatialCoverage(page);`,
    'fixture spatial mock registration',
  );
  text = replaceOnce(
    text,
    `async function mockCursorSearch(\n`,
    `async function mockResearchSpatialCoverage(page: Page): Promise<void> {\n  await page.route('**/api/maps/research-coverage**', async (route) => {\n    const url = new URL(route.request().url());\n    const viewport = {\n      west: Number(url.searchParams.get('west') ?? -125),\n      south: Number(url.searchParams.get('south') ?? 30),\n      east: Number(url.searchParams.get('east') ?? -110),\n      north: Number(url.searchParams.get('north') ?? 45),\n    };\n    const featureLimit = positiveInteger(url.searchParams.get('featureLimit'), 200);\n\n    await route.fulfill({\n      contentType: 'application/json',\n      json: {\n        buildId: 'data-gov-spatial-e2e',\n        sourceSystem: 'DATA_GOV',\n        schemaVersion: 1,\n        sourceSnapshotAt: '2026-09-02T12:00:00Z',\n        capturedAt: '2026-09-02T12:05:00Z',\n        compositionSha256: 'a'.repeat(64),\n        projectionId: 'projection-e2e',\n        criteriaFingerprint: 'criteria-e2e',\n        viewport,\n        summary: {\n          matchingRecords: 33,\n          mappedRecords: 30,\n          unmappedRecords: 3,\n          quarantinedRecords: 1,\n          unanchoredAntimeridianRecords: 0,\n          viewportMappedRecords: 3,\n          returnedFeatures: 2,\n          omittedFeatures: 1,\n          featureLimit,\n          truncated: true,\n        },\n        features: [\n          {\n            sourceSystem: 'DATA_GOV',\n            sourceIdentifier: 'publisher-climate-polygon',\n            title: 'California Climate Resilience Study',\n            publisher: 'U.S. Census Bureau',\n            program: 'TIGER_LINE',\n            contentType: 'DATASET',\n            sourceUrl: 'https://catalog.data.gov/dataset/california-climate-resilience',\n            geometryStatus: 'VALID',\n            geometry: {\n              type: 'Polygon',\n              coordinates: [[[-122.6, 37.1], [-121.8, 37.1], [-121.8, 37.8], [-122.6, 37.1]]],\n            },\n            renderLon: -122.2,\n            renderLat: 37.45,\n            renderPointMethod: 'SHAPE_BOUNDS_CENTER',\n          },\n          {\n            sourceSystem: 'DATA_GOV',\n            sourceIdentifier: 'publisher-water-point',\n            title: 'Western Water Research Observatory',\n            publisher: 'U.S. Census Bureau',\n            program: 'LODES',\n            contentType: 'DATASET',\n            sourceUrl: 'https://catalog.data.gov/dataset/western-water-research',\n            geometryStatus: 'VALID',\n            geometry: { type: 'Point', coordinates: [-118.25, 34.05] },\n            renderLon: -118.25,\n            renderLat: 34.05,\n            renderPointMethod: 'SHAPE_BOUNDS_CENTER',\n          },\n        ],\n      },\n    });\n  });\n}\n\nasync function mockCursorSearch(\n`,
    'bounded spatial mock function',
  );
  writeFileSync(path, text);
}

// MapLibre layer registration / visibility contract.
{
  const path = 'apps/discovery-ui-e2e/src/support/map-layer-visibility.ts';
  let text = readFileSync(path, 'utf8');
  text = replaceOnce(
    text,
    `  'repository-research-coverage-circles',\n  'repository-research-coverage-labels',`,
    `  'repository-research-coverage-fill',\n  'repository-research-coverage-line',\n  'repository-research-coverage-points',`,
    'registered research layers',
  );
  text = replaceOnce(
    text,
    `    name: 'Repository research by area',\n    toggleTestId: 'map-layer-research-coverage',\n    mapLayerIds: [\n      'repository-research-coverage-circles',\n      'repository-research-coverage-labels',\n    ],\n    accessibleListText: 'Repository research by area',\n    legendText: /Repository research by area/,`,
    `    name: 'Data.gov publisher research geometry',\n    toggleTestId: 'map-layer-research-coverage',\n    mapLayerIds: [\n      'repository-research-coverage-fill',\n      'repository-research-coverage-line',\n      'repository-research-coverage-points',\n    ],\n    accessibleListText: 'Data.gov publisher research geometry',\n    legendText: /Data.gov publisher research geometry/,`,
    'research visibility group',
  );
  writeFileSync(path, text);
}
