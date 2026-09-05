import { expect, test, type Page } from '@playwright/test';
import { mockRepositoryApi } from './support/repository-api-mocks';

type SelectionFeatureSnapshot = {
  sourceIdentifier: string | null;
  selectionGeometry: string | null;
  geometryType: string | null;
};

type SelectionSourceSnapshot = {
  ready: boolean;
  features: SelectionFeatureSnapshot[];
};

async function openResearchCoverage(page: Page): Promise<void> {
  await page.goto(
    '/maps?view=workforce&area=California&q=climate' +
      '&program=TIGER_LINE&program=LODES' +
      '&publisher=U.S.%20Census%20Bureau' +
      '&sourceSystem=DATA_GOV&type=DATASET',
  );

  await expect(
    page.getByRole('heading', {
      name: 'California Workforce Explorer',
    }),
  ).toBeVisible();

  const category = page.getByTestId('map-layer-category-research-coverage');
  const categorySummary = page.getByTestId(
    'map-layer-category-research-coverage-summary',
  );
  const toggle = page.getByTestId('map-layer-research-coverage');

  if (
    !(await category.evaluate(
      (element) => (element as HTMLDetailsElement).open,
    ))
  ) {
    await categorySummary.click();
  }

  await expect(category).toHaveJSProperty('open', true);

  if (!(await toggle.isChecked())) {
    await toggle.check();
  }

  await expect(toggle).toBeChecked();

  await expect(
    page.getByRole('heading', {
      name: 'Data.gov research extents',
    }),
  ).toBeVisible();
}

async function readSelectionSource(
  page: Page,
): Promise<SelectionSourceSnapshot> {
  return page.evaluate(() => {
    const container = document.querySelector(
      '[data-testid="discovery-map-canvas"]',
    );

    const map = (
      container as HTMLElement & {
        __map?: {
          getSource: (id: string) => unknown;
        };
      }
    )?.__map;

    if (!map) {
      return {
        ready: false,
        features: [],
      };
    }

    const source = map.getSource('repository-research-coverage-selection') as
      | {
          serialize: () => {
            data?: {
              type?: string;
              features?: Array<{
                properties?: Record<string, unknown>;
                geometry?: {
                  type?: string;
                };
              }>;
            };
          };
        }
      | undefined;

    if (!source) {
      return {
        ready: false,
        features: [],
      };
    }

    const data = source.serialize().data;

    if (
      !data ||
      data.type !== 'FeatureCollection' ||
      !Array.isArray(data.features)
    ) {
      return {
        ready: true,
        features: [],
      };
    }

    return {
      ready: true,
      features: data.features.map((feature) => ({
        sourceIdentifier:
          typeof feature.properties?.['sourceIdentifier'] === 'string'
            ? feature.properties['sourceIdentifier']
            : null,
        selectionGeometry:
          typeof feature.properties?.['selectionGeometry'] === 'string'
            ? feature.properties['selectionGeometry']
            : null,
        geometryType:
          typeof feature.geometry?.type === 'string'
            ? feature.geometry.type
            : null,
      })),
    };
  });
}

async function mockClusteredResearchCoverage(page: Page): Promise<void> {
  // Registered after mockRepositoryApi(), so this more-specific test fixture
  // wins for the cluster test without changing the shared semantic fixture.
  await page.route('**/api/maps/research-coverage**', async (route) => {
    const url = new URL(route.request().url());

    await route.fulfill({
      contentType: 'application/json',
      json: {
        buildId: 'data-gov-spatial-cluster-e2e',
        sourceSystem: 'DATA_GOV',
        schemaVersion: 1,
        sourceSnapshotAt: '2026-09-02T12:00:00Z',
        capturedAt: '2026-09-02T12:05:00Z',
        compositionSha256: 'b'.repeat(64),
        projectionId: 'projection-cluster-e2e',
        criteriaFingerprint: 'criteria-cluster-e2e',
        viewport: {
          west: Number(url.searchParams.get('west') ?? -180),
          south: Number(url.searchParams.get('south') ?? -90),
          east: Number(url.searchParams.get('east') ?? 180),
          north: Number(url.searchParams.get('north') ?? 90),
        },
        summary: {
          matchingRecords: 3,
          mappedRecords: 3,
          unmappedRecords: 0,
          quarantinedRecords: 0,
          unanchoredAntimeridianRecords: 0,
          viewportMappedRecords: 3,
          returnedFeatures: 3,
          omittedFeatures: 0,
          featureLimit: 200,
          truncated: false,
        },
        features: [
          {
            sourceSystem: 'DATA_GOV',
            sourceIdentifier: 'cluster-alpha',
            title: 'Cluster Research Alpha',
            publisher: 'Example Federal Agency',
            program: 'CLIMATE',
            contentType: 'DATASET',
            sourceUrl: null,
            geometryStatus: 'VALID',
            geometry: {
              type: 'Point',
              coordinates: [-122.4194, 37.7749],
            },
            renderLon: -122.4194,
            renderLat: 37.7749,
            renderPointMethod: 'SHAPE_BOUNDS_CENTER',
          },
          {
            sourceSystem: 'DATA_GOV',
            sourceIdentifier: 'cluster-bravo',
            title: 'Cluster Research Bravo',
            publisher: 'Example Federal Agency',
            program: 'CLIMATE',
            contentType: 'DATASET',
            sourceUrl: null,
            geometryStatus: 'VALID',
            geometry: {
              type: 'Point',
              coordinates: [-122.414, 37.779],
            },
            renderLon: -122.414,
            renderLat: 37.779,
            renderPointMethod: 'SHAPE_BOUNDS_CENTER',
          },
          {
            sourceSystem: 'DATA_GOV',
            sourceIdentifier: 'cluster-charlie',
            title: 'Cluster Research Charlie',
            publisher: 'Example Federal Agency',
            program: 'CLIMATE',
            contentType: 'DATASET',
            sourceUrl: null,
            geometryStatus: 'VALID',
            geometry: {
              type: 'Point',
              coordinates: [-122.409, 37.77],
            },
            renderLon: -122.409,
            renderLat: 37.77,
            renderPointMethod: 'SHAPE_BOUNDS_CENTER',
          },
        ],
      },
    });
  });
}

async function mockAntimeridianResearchCoverage(page: Page): Promise<void> {
  await page.route('**/api/maps/research-coverage**', async (route) => {
    const url = new URL(route.request().url());

    await route.fulfill({
      contentType: 'application/json',
      json: {
        buildId: 'data-gov-spatial-antimeridian-e2e',
        sourceSystem: 'DATA_GOV',
        schemaVersion: 1,
        sourceSnapshotAt: '2026-09-02T12:00:00Z',
        capturedAt: '2026-09-02T12:05:00Z',
        compositionSha256: 'c'.repeat(64),
        projectionId: 'projection-antimeridian-e2e',
        criteriaFingerprint: 'criteria-antimeridian-e2e',
        viewport: {
          west: Number(url.searchParams.get('west') ?? -180),
          south: Number(url.searchParams.get('south') ?? -90),
          east: Number(url.searchParams.get('east') ?? 180),
          north: Number(url.searchParams.get('north') ?? 90),
        },
        summary: {
          matchingRecords: 1,
          mappedRecords: 1,
          unmappedRecords: 0,
          quarantinedRecords: 0,
          unanchoredAntimeridianRecords: 0,
          viewportMappedRecords: 1,
          returnedFeatures: 1,
          omittedFeatures: 0,
          featureLimit: 200,
          truncated: false,
        },
        features: [
          {
            sourceSystem: 'DATA_GOV',
            sourceIdentifier: 'antimeridian-observation',
            title: 'Pacific Observation Coverage',
            publisher: 'Example Federal Agency',
            program: 'OCEAN',
            contentType: 'DATASET',
            sourceUrl: null,
            geometryStatus: 'ANTIMERIDIAN_CANDIDATE',
            geometry: {
              type: 'Polygon',
              coordinates: [
                [
                  [179, 10],
                  [-179, 10],
                  [-179, 11],
                  [179, 10],
                ],
              ],
            },
            renderLon: 179.5,
            renderLat: 10.5,
            renderPointMethod:
              'DATA_GOV_SOURCE_POINT_FOR_ANTIMERIDIAN_CANDIDATE',
          },
        ],
      },
    });
  });
}

test.describe('Data.gov research extent MapLibre interaction', () => {
  test.beforeEach(async ({ page }) => {
    await mockRepositoryApi(page);
  });

  test('renders no default footprint, exactly one selected footprint, then clears it @maps', async ({
    page,
  }) => {
    await openResearchCoverage(page);

    await expect
      .poll(async () => (await readSelectionSource(page)).ready)
      .toBe(true);

    await expect
      .poll(async () => (await readSelectionSource(page)).features)
      .toEqual([]);

    const climate = page.getByRole('button', {
      name: 'California Climate Resilience Study',
    });

    await climate.click();

    await expect(climate).toHaveAttribute('aria-pressed', 'true');

    await expect
      .poll(async () => {
        const snapshot = await readSelectionSource(page);

        return snapshot.features
          .map((feature) => ({
            sourceIdentifier: feature.sourceIdentifier,
            selectionGeometry: feature.selectionGeometry,
            geometryType: feature.geometryType,
          }))
          .sort((left, right) =>
            String(left.selectionGeometry).localeCompare(
              String(right.selectionGeometry),
            ),
          );
      })
      .toEqual([
        {
          sourceIdentifier: 'publisher-climate-polygon',
          selectionGeometry: 'ANCHOR',
          geometryType: 'Point',
        },
        {
          sourceIdentifier: 'publisher-climate-polygon',
          selectionGeometry: 'FOOTPRINT',
          geometryType: 'Polygon',
        },
      ]);

    await expect(
      page.getByRole('status', {
        name: 'Research extent selection',
      }),
    ).toContainText('Selected California Climate Resilience Study');

    await page
      .getByRole('button', {
        name: 'Clear research extent selection',
      })
      .click();

    await expect
      .poll(async () => (await readSelectionSource(page)).features)
      .toEqual([]);
  });

  test('antimeridian candidate selection remains anchor-only @maps', async ({
    page,
  }) => {
    await mockAntimeridianResearchCoverage(page);
    await openResearchCoverage(page);

    await expect(
      page.getByText(/Spatial build data-gov-spatial-antimeridian-e2e/),
    ).toBeVisible();

    await expect
      .poll(async () => (await readSelectionSource(page)).ready)
      .toBe(true);

    const record = page.getByRole('button', {
      name: 'Pacific Observation Coverage',
    });

    await expect(record).toBeVisible();
    await record.click();

    await expect(record).toHaveAttribute('aria-pressed', 'true');

    await expect
      .poll(async () => (await readSelectionSource(page)).features)
      .toEqual([
        {
          sourceIdentifier: 'antimeridian-observation',
          selectionGeometry: 'ANCHOR',
          geometryType: 'Point',
        },
      ]);

    await expect(
      page.getByText(
        'Source-derived display anchor for antimeridian candidate',
      ),
    ).toBeVisible();
  });

  test('clustered research anchors expose a higher MapLibre expansion zoom @maps', async ({
    page,
  }) => {
    await mockClusteredResearchCoverage(page);
    await openResearchCoverage(page);

    await page.evaluate(() => {
      const container = document.querySelector(
        '[data-testid="discovery-map-canvas"]',
      );

      const map = (
        container as HTMLElement & {
          __map?: {
            jumpTo: (options: { zoom: number }) => void;
          };
        }
      )?.__map;

      map?.jumpTo({ zoom: 3 });
    });

    await expect
      .poll(async () => {
        return page.evaluate(async () => {
          const container = document.querySelector(
            '[data-testid="discovery-map-canvas"]',
          );

          const map = (
            container as HTMLElement & {
              __map?: {
                getZoom: () => number;
                getSource: (id: string) => unknown;
                queryRenderedFeatures: (options: {
                  layers: string[];
                }) => Array<{
                  properties?: Record<string, unknown>;
                }>;
              };
            }
          )?.__map;

          if (!map) {
            return 0;
          }

          const cluster = map.queryRenderedFeatures({
            layers: ['repository-research-coverage-clusters'],
          })[0];

          const clusterId = Number(cluster?.properties?.['cluster_id']);
          const count = Number(cluster?.properties?.['point_count']);

          if (
            !Number.isFinite(clusterId) ||
            !Number.isFinite(count) ||
            count <= 1
          ) {
            return 0;
          }

          const source = map.getSource('repository-research-coverage') as
            | {
                getClusterExpansionZoom: (clusterId: number) => Promise<number>;
              }
            | undefined;

          if (!source) {
            return 0;
          }

          const expansionZoom = await source.getClusterExpansionZoom(clusterId);

          return expansionZoom - map.getZoom();
        });
      })
      .toBeGreaterThan(0);
  });
});
