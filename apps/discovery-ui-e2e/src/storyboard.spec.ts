import { expect, test } from '@playwright/test';
import { mockRepositoryApi } from './support/repository-api-mocks';
import { mockSearchComparisonApi } from './support/search-comparison-mocks';

/**
 * Storyboard tests exercise the user-visible evidence that the repository is doing what its
 * architecture says it does. They deliberately avoid implementation details where the page already
 * exposes a semantic label, table, heading, status, or accessible relationship.
 */

// NOTE: this file content is intentionally not replaced wholesale here because it is large.
