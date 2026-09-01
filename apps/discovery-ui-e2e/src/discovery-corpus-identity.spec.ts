import { expect, test } from '@playwright/test';
import { mockRepositoryApi } from './support/repository-api-mocks';

test.describe('Discovery corpus identity', () => {
  test('shows the exact active 1m corpus independently from query result count', async ({
    page,
  }) => {
    await mockRepositoryApi(page);

    await page.route('**/api/admin/corpus/storage', async (route) => {
      await route.fulfill({
        contentType: 'application/json',
        json: {
          activeProfile: 'FEDERATED_1M',
          profiles: [
            {
              profile: 'FEDERATED_1M',
              label: 'Federated 1M',
              active: true,
              targetFederatedRecordCount: 1_000_000,
            },
          ],
          history: [],
        },
      });
    });

    await page.route('**/api/admin/reindex', async (route) => {
      await route.fulfill({
        contentType: 'application/json',
        json: {
          source: 'REPOSITORY',
          objectCount: 1_000_181,
          projectionId:
            '3d461a9feb49f7239f3f6aaacb0c90f1ff43d0c683238acc2202c841154db44d',
        },
      });
    });

    await page.goto('/discovery');

    const identity = page.getByTestId('active-corpus-identity');
    await expect(identity).toBeVisible();
    await expect(identity).toContainText('Federated 1M');
    await expect(identity).toContainText('1,000,181 documents');
    await expect(identity).toContainText(
      'C2 exact · 500K Data.gov + 500K DOE OSTI',
    );
    await expect(identity).toContainText('projection 3d461a9feb49…');

    await expect(
      page.getByRole('heading', { name: /research objects$/ }),
    ).toBeVisible();
  });
});
