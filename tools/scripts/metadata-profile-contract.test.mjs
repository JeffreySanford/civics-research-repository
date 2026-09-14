import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const catalog = JSON.parse(readFileSync('tools/dspace/catalog.json', 'utf8'));
const fixture = JSON.parse(
  readFileSync(
    'apps/repository-api/src/main/resources/discovery-fixture-catalog.json',
    'utf8',
  ),
);

const restricted = catalog.researchObjects.find(
  (item) => item.id === 'lehd-microdata-restricted',
);
const fixtureRestricted = fixture.items.find(
  (item) => item.id === 'lehd-microdata-restricted',
);

const expectedGuidance = {
  mechanism: 'FSRDC',
  accessUrl: 'https://www.census.gov/about/adrm/fsrdc.html',
  instructions:
    'Access requires an approved research proposal and Special Sworn Status through a Federal Statistical Research Data Center.',
  restrictionBasis: 'Title 13, U.S. Code',
};

test('restricted LEHD metadata exposes structured FSRDC guidance but no files', () => {
  assert.ok(restricted, 'restricted LEHD catalog object must exist');
  assert.equal(restricted.access, 'RESTRICTED');
  assert.deepEqual(restricted.files, []);
  assert.deepEqual(restricted.accessGuidance, expectedGuidance);
});

test('generated fixture preserves the catalog access guidance exactly', () => {
  assert.ok(fixtureRestricted, 'restricted LEHD fixture object must exist');
  assert.deepEqual(fixtureRestricted.accessGuidance, expectedGuidance);
});
