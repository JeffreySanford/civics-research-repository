import { readFileSync, writeFileSync } from 'node:fs';

function replaceRequired(path, needle, replacement) {
  const text = readFileSync(path, 'utf8');
  if (!text.includes(needle)) {
    throw new Error(`Missing expected limit-parameter target in ${path}`);
  }
  writeFileSync(path, text.replace(needle, replacement));
}

replaceRequired(
  'apps/discovery-ui-e2e/src/research-coverage.spec.ts',
  "expect(requestUrl.searchParams.get('featureLimit')).toBe('200');",
  "expect(requestUrl.searchParams.get('limit')).toBe('200');",
);

replaceRequired(
  'apps/discovery-ui-e2e/src/support/repository-api-mocks.ts',
  "positiveInteger(url.searchParams.get('featureLimit'), 200)",
  "positiveInteger(url.searchParams.get('limit'), 200)",
);
