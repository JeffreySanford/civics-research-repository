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

const researchObjects = (catalog.researchObjects ?? []).filter(
  (item) => item.enabled !== false,
);
const restricted = researchObjects.find(
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

function isNonBlank(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

test('catalog contains representative research-object types', () => {
  const types = new Set(researchObjects.map((item) => item.resourceType));
  for (const requiredType of [
    'DATASET',
    'PUBLICATION',
    'METHODOLOGY',
    'PROJECT',
    'CODE',
  ]) {
    assert.ok(types.has(requiredType), `catalog must include ${requiredType}`);
  }
});

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

test('at least one DOI-bearing publication records an ORCID author', () => {
  const publication = researchObjects.find(
    (item) =>
      item.resourceType === 'PUBLICATION' &&
      isNonBlank(item.doi) &&
      (item.authors ?? []).some((author) => isNonBlank(author.orcid)),
  );

  assert.ok(
    publication,
    'catalog must include a DOI-bearing publication with at least one ORCID author',
  );
});

test('optional DOI, ORCID, and structured access URLs are never stored blank', () => {
  for (const item of researchObjects) {
    if (Object.hasOwn(item, 'doi')) {
      assert.ok(isNonBlank(item.doi), `${item.id} DOI must not be blank`);
    }

    for (const author of item.authors ?? []) {
      if (Object.hasOwn(author, 'orcid')) {
        assert.ok(
          isNonBlank(author.orcid),
          `${item.id} author ORCID must not be blank`,
        );
      }
    }

    if (item.accessGuidance && Object.hasOwn(item.accessGuidance, 'accessUrl')) {
      assert.ok(
        isNonBlank(item.accessGuidance.accessUrl),
        `${item.id} access guidance URL must not be blank`,
      );
    }
  }
});
