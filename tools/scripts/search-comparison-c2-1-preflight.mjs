import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  C2_1_EXPECTED,
  sha256Json,
  writeC21ExecutionManifest,
} from './search-comparison-c2-1-manifest.mjs';
import {
  C2_1_ADMITTED_TREATMENT,
  writeC21SemanticAdmission,
} from './search-comparison-c2-1-semantic-admission.mjs';

const DEFAULT_OUTPUT =
  'browser-evidence-artifacts/c2-1/preflight-authorization.json';

export function buildC21PreflightAuthorization({ manifest, semantic }) {
  if (manifest?.timingAllowed !== true) {
    throw new Error('C2.1 execution manifest did not authorize timing.');
  }
  if (manifest?.comparativeClaimAllowed !== false) {
    throw new Error(
      'C2.1 execution manifest lost the comparative-claim guardrail.',
    );
  }
  if (semantic?.admitted !== true) {
    throw new Error(
      'C2.1 optimized OpenSearch treatment was not semantically admitted.',
    );
  }
  if (
    semantic?.timingDiscarded !== true ||
    semantic?.timingEvidenceAdmitted !== false
  ) {
    throw new Error(
      'C2.1 semantic admission must explicitly discard incidental timing.',
    );
  }
  if (semantic?.admittedTreatment !== C2_1_ADMITTED_TREATMENT) {
    throw new Error(
      `C2.1 semantic admission must authorize ${C2_1_ADMITTED_TREATMENT}.`,
    );
  }
  if (
    manifest?.certifiedControl?.projectionId !== C2_1_EXPECTED.projectionId ||
    semantic?.projectionId !== C2_1_EXPECTED.projectionId
  ) {
    throw new Error(
      'C2.1 preflight artifacts do not share the certified projection.',
    );
  }
  if (
    Number(manifest?.certifiedControl?.projectionObjectCount) !==
      C2_1_EXPECTED.projectionObjectCount ||
    Number(semantic?.projectionObjectCount) !==
      C2_1_EXPECTED.projectionObjectCount
  ) {
    throw new Error(
      'C2.1 preflight artifacts do not share the certified projection count.',
    );
  }

  const unavailableBands = Array.isArray(semantic?.unavailableBands)
    ? semantic.unavailableBands
    : [];

  return {
    experiment: 'C2.1_ADVERSARIAL_STANDALONE',
    kind: 'preflight-authorization',
    status: 'READY',
    timingAllowed: true,
    comparativeClaimAllowed: false,
    repositoryCommit: manifest.repositoryCommit,
    protocol: manifest.protocol,
    projectionId: C2_1_EXPECTED.projectionId,
    projectionObjectCount: C2_1_EXPECTED.projectionObjectCount,
    openSearchTreatment: C2_1_ADMITTED_TREATMENT,
    executionPlan: manifest.executionPlan,
    filterBands: semantic.filterSelection?.bands ?? [],
    unavailableBands,
    manifestSha256: sha256Json(manifest),
    semanticAdmissionSha256: sha256Json(semantic),
    guardrail:
      'READY authorizes C2.1 collection only for the exact manifest, semantic-admission treatment, certified projection, and execution plan hashed here. It does not authorize a universal Solr/OpenSearch winner claim.',
  };
}

export async function writeC21PreflightAuthorization({
  output = DEFAULT_OUTPUT,
  manifestOutput,
  semanticOutput,
  manifestOptions = {},
  semanticOptions = {},
} = {}) {
  const { manifest, outputPath: manifestPath } =
    await writeC21ExecutionManifest({
      ...(manifestOutput ? { output: manifestOutput } : {}),
      ...manifestOptions,
    });
  const { evidence: semantic, outputPath: semanticPath } =
    await writeC21SemanticAdmission({
      ...(semanticOutput ? { output: semanticOutput } : {}),
      ...semanticOptions,
    });
  const authorization = buildC21PreflightAuthorization({ manifest, semantic });
  const outputPath = resolve(output);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(
    outputPath,
    `${JSON.stringify(authorization, null, 2)}\n`,
    'utf8',
  );
  return {
    authorization,
    outputPath,
    manifestPath,
    semanticPath,
  };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  writeC21PreflightAuthorization()
    .then(({ authorization, outputPath }) => {
      console.log(`C2.1 preflight READY: ${outputPath}`);
      console.log(
        `projection ${authorization.projectionId}; treatment ${authorization.openSearchTreatment}; batches ${authorization.executionPlan.totalBatches}`,
      );
      if (authorization.unavailableBands.length > 0) {
        console.log(
          `Unavailable filter bands retained: ${authorization.unavailableBands.map((band) => band.band).join(', ')}`,
        );
      }
    })
    .catch((error) => {
      console.error(`C2.1 preflight REFUSED: ${error.message}`);
      process.exitCode = 1;
    });
}
