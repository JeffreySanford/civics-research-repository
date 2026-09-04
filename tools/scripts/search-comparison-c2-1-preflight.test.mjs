import assert from 'node:assert/strict';
import test from 'node:test';
import { buildC21PreflightAuthorization } from './search-comparison-c2-1-preflight.mjs';
import { C2_1_EXPECTED } from './search-comparison-c2-1-manifest.mjs';
import { C2_1_ADMITTED_TREATMENT } from './search-comparison-c2-1-semantic-admission.mjs';

function manifest() {
  return {
    timingAllowed: true,
    comparativeClaimAllowed: false,
    repositoryCommit: 'a'.repeat(40),
    protocol: {
      path: 'planning/C2_ADVERSARIAL_VALIDATION_PROTOCOL.md',
      commit: 'b'.repeat(40),
      sha256: 'c'.repeat(64),
    },
    certifiedControl: {
      projectionId: C2_1_EXPECTED.projectionId,
      projectionObjectCount: C2_1_EXPECTED.projectionObjectCount,
    },
    executionPlan: {
      totalBatches: 16,
      solrFirstBatches: 8,
      openSearchFirstBatches: 8,
    },
  };
}

function semantic() {
  return {
    admitted: true,
    timingDiscarded: true,
    timingEvidenceAdmitted: false,
    admittedTreatment: C2_1_ADMITTED_TREATMENT,
    projectionId: C2_1_EXPECTED.projectionId,
    projectionObjectCount: C2_1_EXPECTED.projectionObjectCount,
    filterSelection: {
      bands: [
        { band: 'BROAD', status: 'SELECTED' },
        { band: 'MODERATE', status: 'SELECTED' },
        { band: 'SELECTIVE', status: 'SELECTED' },
      ],
    },
    unavailableBands: [],
  };
}

test('READY authorization binds the exact manifest and semantic admission', () => {
  const authorization = buildC21PreflightAuthorization({
    manifest: manifest(),
    semantic: semantic(),
  });

  assert.equal(authorization.status, 'READY');
  assert.equal(authorization.timingAllowed, true);
  assert.equal(authorization.comparativeClaimAllowed, false);
  assert.equal(authorization.projectionId, C2_1_EXPECTED.projectionId);
  assert.equal(authorization.openSearchTreatment, C2_1_ADMITTED_TREATMENT);
  assert.equal(authorization.executionPlan.totalBatches, 16);
  assert.match(authorization.manifestSha256, /^[0-9a-f]{64}$/u);
  assert.match(authorization.semanticAdmissionSha256, /^[0-9a-f]{64}$/u);
});

test('preflight refuses an unadmitted treatment or retained semantic timing', () => {
  assert.throws(
    () =>
      buildC21PreflightAuthorization({
        manifest: manifest(),
        semantic: { ...semantic(), admitted: false },
      }),
    /was not semantically admitted/,
  );
  assert.throws(
    () =>
      buildC21PreflightAuthorization({
        manifest: manifest(),
        semantic: { ...semantic(), timingEvidenceAdmitted: true },
      }),
    /discard incidental timing/,
  );
});

test('preflight refuses projection drift across its two source artifacts', () => {
  assert.throws(
    () =>
      buildC21PreflightAuthorization({
        manifest: manifest(),
        semantic: { ...semantic(), projectionId: 'd'.repeat(64) },
      }),
    /do not share the certified projection/,
  );
});
