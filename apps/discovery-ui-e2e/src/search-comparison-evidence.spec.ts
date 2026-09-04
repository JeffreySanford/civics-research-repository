import { expect, test } from '@playwright/test';
import { mockRepositoryApi } from './support/repository-api-mocks';
import { mockSearchComparisonApi } from './support/search-comparison-mocks';

function c21EvidenceFixture() {
  const queryCells = Array.from({ length: 20 }, (_, index) => {
    const id = `Q${String(index + 1).padStart(2, '0')}`;
    const isQ02 = id === 'Q02';
    const isQ20 = id === 'Q20';
    return {
      id,
      workload: isQ02 ? 'data' : isQ20 ? 'no-result control' : `query ${index + 1}`,
      totalHits: isQ02 ? 866_048 : isQ20 ? 0 : index + 100,
      apiElapsed: {
        medianDifferenceMs: isQ02 ? 56 : isQ20 ? 1 : 8,
        lower95Ms: isQ02 ? 55 : isQ20 ? 1 : 8,
        upper95Ms: isQ02 ? 58 : isQ20 ? 2 : 8,
        solrWinRatePercent: 100,
        excludesZero: true,
        interpretation:
          'Positive differences mean OpenSearch took longer than Solr.',
      },
    };
  });

  return {
    profile: 'FEDERATED_1M',
    capturedAt: '2026-09-03T19:06:00Z',
    scope: 'LOCAL_CERTIFIED_TOPOLOGY_ONLY',
    comparativeClaimAllowed: false,
    projectionId:
      'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    projectionObjectCount: 1_000_181,
    retainedFederatedRecords: 1_000_000,
    targetParity: true,
    claimGuardrail: 'Historical C2 scoped local evidence only.',
    executionControls: null,
    standaloneBatchEvidence: null,
    orderRobustness: null,
    pairedWorkloads: [],
    concurrency: [],
    c21Adversarial: {
      capturedAt: '2026-09-04T15:23:00Z',
      openSearchTreatment: 'C2_1_OPTIMIZED_EQUIVALENT',
      workloadCellCount: 24,
      restartBlocks: 4,
      independentBatchSummariesPerCell: 16,
      solrLowerLatencyCells: 24,
      openSearchLowerLatencyCells: 0,
      tiedCells: 0,
      ciExcludesZeroFavoringSolr: 24,
      ciExcludesZeroFavoringOpenSearch: 0,
      cells: [
        ...queryCells,
        {
          id: 'FACETS',
          workload: 'corpus-wide facets',
          totalHits: 1_000_181,
          apiElapsed: {
            medianDifferenceMs: 20,
            lower95Ms: 19,
            upper95Ms: 21,
            solrWinRatePercent: 100,
            excludesZero: true,
            interpretation:
              'Positive differences mean OpenSearch took longer than Solr.',
          },
        },
        {
          id: 'FILTER_BROAD',
          workload: 'broad filter',
          totalHits: 500_000,
          apiElapsed: {
            medianDifferenceMs: 24,
            lower95Ms: 23,
            upper95Ms: 24,
            solrWinRatePercent: 100,
            excludesZero: true,
            interpretation:
              'Positive differences mean OpenSearch took longer than Solr.',
          },
        },
        {
          id: 'FILTER_MODERATE',
          workload: 'moderate filter',
          totalHits: 168_176,
          apiElapsed: {
            medianDifferenceMs: 17,
            lower95Ms: 16,
            upper95Ms: 18,
            solrWinRatePercent: 100,
            excludesZero: true,
            interpretation:
              'Positive differences mean OpenSearch took longer than Solr.',
          },
        },
        {
          id: 'FILTER_SELECTIVE',
          workload: 'selective filter',
          totalHits: 14_166,
          apiElapsed: {
            medianDifferenceMs: 14,
            lower95Ms: 14,
            upper95Ms: 14,
            solrWinRatePercent: 100,
            excludesZero: true,
            interpretation:
              'Positive differences mean OpenSearch took longer than Solr.',
          },
        },
      ],
      claimGuardrail: 'Scoped C2.1 claims only; no universal engine ranking.',
    },
    resources: {
      captured: true,
      interpretation: 'Counters and observations remain distinct.',
      counterResetDetected: false,
      counterResetFields: [],
    },
  };
}

test.describe('Evidence search comparison', () => {
  test.beforeEach(async ({ page }) => {
    await mockRepositoryApi(page);
    await mockSearchComparisonApi(page);
    await page.route('**/api/admin/reindex', async (route) => {
      await route.fulfill({
        contentType: 'application/json',
        json: {
          source: 'REPOSITORY',
          objectCount: 181,
          rebuiltAt: '2026-08-29T17:00:00Z',
        },
      });
    });
  });

  test('separates deterministic, live, performance, and manual evidence @storyboard @comparison', async ({
    page,
  }) => {
    await page.goto('/evidence');
    await page.getByRole('tab', { name: 'Search comparison' }).click();

    await expect(
      page.getByRole('heading', { name: 'Normalize once, project many' }),
    ).toBeVisible();
    await expect(page.getByText('Projection parity verified.')).toBeVisible();

    const table = page.getByRole('table', {
      name: 'Search comparison evidence types and verification boundaries',
    });
    await expect(table).toBeVisible();
    await expect(
      table.getByRole('rowheader', { name: 'Mocked browser comparison' }),
    ).toBeVisible();
    await expect(
      table.getByRole('rowheader', { name: 'Live Solr/OpenSearch smoke' }),
    ).toBeVisible();
    await expect(
      table.getByRole('rowheader', { name: 'Performance distributions' }),
    ).toBeVisible();
    await expect(table.getByText('5 warm-ups / 100 measured')).toBeVisible();
    await expect(
      table.getByText(/Solr QTime \/ OpenSearch took/),
    ).toBeVisible();
    await expect(
      table.getByRole('rowheader', {
        name: 'Keyboard and screen-reader comparison flow',
      }),
    ).toBeVisible();
    await expect(table.getByText('Pending', { exact: true })).toBeVisible();
    await expect(
      page.getByText(/does not synthesize a green build status/),
    ).toBeVisible();
  });

  test('keeps historical C2 and adversarial C2.1 as separate inspectable layers @storyboard @comparison', async ({
    page,
  }) => {
    await page.route('**/api/evidence/search-performance', async (route) => {
      await route.fulfill({
        contentType: 'application/json',
        json: c21EvidenceFixture(),
      });
    });

    await page.goto('/evidence');
    await page.getByRole('tab', { name: 'Search comparison' }).click();

    await expect(
      page.getByRole('heading', { name: 'Historical C2 baseline' }),
    ).toBeVisible();
    await expect(
      page.getByText('Historical C2 claim boundary:', { exact: false }),
    ).toBeVisible();

    const c21 = page.getByTestId('c2-1-adversarial-evidence');
    await expect(
      c21.getByRole('heading', { name: 'Adversarial C2.1 validation' }),
    ).toBeVisible();
    await expect(c21).toContainText('24 / 24');
    await expect(c21).toContainText('16');
    await expect(c21).toContainText('4');
    await expect(c21).toContainText('C2_1_OPTIMIZED_EQUIVALENT');
    await expect(c21).toContainText('samples remain separate from historical C2');

    const table = c21.getByRole('table', {
      name: /C2\.1 batch-level API latency inference/,
    });
    await expect(table.getByRole('row')).toHaveCount(25);
    await expect(table.getByRole('rowheader', { name: 'Q02' })).toBeVisible();
    await expect(table.getByText('866,048')).toBeVisible();
    await expect(
      table.getByRole('rowheader', { name: 'FILTER_BROAD' }),
    ).toBeVisible();
    await expect(table.getByText('500,000')).toBeVisible();
    await expect(c21.getByText('Scoped C2.1 claims only; no universal engine ranking.')).toBeVisible();
  });
});
