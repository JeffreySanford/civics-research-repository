import { expect, test, type Page, type Request } from '@playwright/test';
import {
  failRepositoryApi,
  mockRepositoryApi,
} from './support/repository-api-mocks';

function searchRequests(page: Page): string[] {
  const requests: string[] = [];
  page.on('request', (request: Request) => {
    const url = new URL(request.url());
    if (url.pathname.includes('/api/search')) {
      requests.push(request.url());
    }
  });
  return requests;
}

function cursorRequests(requests: readonly string[]): URL[] {
  return requests
    .map((request) => new URL(request))
    .filter((url) => url.pathname.endsWith('/api/search/cursor'));
}

function offsetRequests(requests: readonly string[]): URL[] {
  return requests
    .map((request) => new URL(request))
    .filter((url) => url.pathname.endsWith('/api/search'));
}

test.describe('Discovery cursor pagination', () => {
  test.beforeEach(async ({ page }) => {
    await mockRepositoryApi(page);
  });

  test('uses opaque cursor traversal for Next and Previous without exposing cursors in the URL @wcag @section508', async ({
    page,
  }) => {
    const requests = searchRequests(page);

    await page.goto('/discovery');
    await expect(
      page.getByRole('heading', { name: '35 research objects' }),
    ).toBeVisible();

    await expect.poll(() => cursorRequests(requests).length).toBe(1);
    const firstRequest = cursorRequests(requests)[0];
    expect(firstRequest.searchParams.has('page')).toBe(false);
    expect(firstRequest.searchParams.has('cursor')).toBe(false);
    expect(firstRequest.searchParams.get('pageSize')).toBe('25');
    expect(offsetRequests(requests)).toHaveLength(0);

    const pager = page.getByRole('navigation', { name: 'Search results pages' });
    await expect(pager.getByText('Page 1 of 2')).toHaveAttribute(
      'aria-current',
      'page',
    );

    await pager.getByRole('button', { name: 'Next' }).click();

    await expect(page).toHaveURL(/(?:\?|&)page=1(?:&|$)/);
    expect(new URL(page.url()).searchParams.has('cursor')).toBe(false);
    await expect(
      page.getByRole('heading', { name: '35 research objects' }),
    ).toBeFocused();
    await expect(pager.getByText('Page 2 of 2')).toHaveAttribute(
      'aria-current',
      'page',
    );

    await expect.poll(() => cursorRequests(requests).length).toBe(2);
    const nextRequest = cursorRequests(requests)[1];
    expect(nextRequest.searchParams.get('cursor')).toBe('mock-cursor-1');
    expect(nextRequest.searchParams.has('page')).toBe(false);

    await pager.getByRole('button', { name: 'Previous' }).click();

    await expect(page).not.toHaveURL(/(?:\?|&)page=/);
    expect(new URL(page.url()).searchParams.has('cursor')).toBe(false);
    await expect(pager.getByText('Page 1 of 2')).toHaveAttribute(
      'aria-current',
      'page',
    );
    await expect.poll(() => cursorRequests(requests).length).toBe(3);
    const previousRequest = cursorRequests(requests)[2];
    expect(previousRequest.searchParams.has('cursor')).toBe(false);
    expect(previousRequest.searchParams.has('page')).toBe(false);
    expect(offsetRequests(requests)).toHaveLength(0);
  });

  test('keeps shared deep-linked pages offset compatible', async ({ page }) => {
    const requests = searchRequests(page);

    await page.goto('/discovery?page=1');
    await expect(
      page.getByRole('heading', { name: '35 research objects' }),
    ).toBeVisible();
    await expect(
      page.getByRole('navigation', { name: 'Search results pages' }).getByText(
        'Page 2 of 2',
      ),
    ).toBeVisible();

    await expect.poll(() => offsetRequests(requests).length).toBe(1);
    expect(cursorRequests(requests)).toHaveLength(0);
    const request = offsetRequests(requests)[0];
    expect(request.searchParams.get('page')).toBe('1');
    expect(request.searchParams.get('pageSize')).toBe('25');
    expect(request.searchParams.has('cursor')).toBe(false);
  });

  test('announces page-zero cursor startup fallback and keeps that traversal offset backed', async ({
    page,
  }) => {
    await failRepositoryApi(page, '**/api/search/cursor**', 503);
    const requests = searchRequests(page);

    await page.goto('/discovery');

    const compatibilityStatus = page.getByRole('status').filter({
      hasText: 'Deep pagination is temporarily unavailable',
    });
    await expect(compatibilityStatus).toContainText('offset-compatible paging');
    await expect(
      page.getByRole('heading', { name: '35 research objects' }),
    ).toBeVisible();
    await expect.poll(() => offsetRequests(requests).length).toBe(1);

    const pager = page.getByRole('navigation', { name: 'Search results pages' });
    await pager.getByRole('button', { name: 'Next' }).click();

    await expect(page).toHaveURL(/(?:\?|&)page=1(?:&|$)/);
    await expect(compatibilityStatus).toContainText('offset-compatible paging');
    await expect.poll(() => offsetRequests(requests).length).toBe(2);
    const nextRequest = offsetRequests(requests)[1];
    expect(nextRequest.searchParams.get('page')).toBe('1');
    expect(nextRequest.searchParams.has('cursor')).toBe(false);
  });
});
