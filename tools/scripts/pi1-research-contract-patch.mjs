import { readFileSync, writeFileSync } from 'node:fs';

const path = 'schemas/openapi/repository-api.yaml';
let source = readFileSync(path, 'utf8');

function replaceOnce(label, before, after) {
  const count = source.split(before).length - 1;
  if (count !== 1) {
    throw new Error(`${label}: expected exactly one match, found ${count}`);
  }
  // Callback replacement is intentional. String.replace interprets replacement tokens such as
  // $', which appears naturally at the end of a regex scalar like "...+$'". Returning the text
  // from a callback makes every dollar sign literal and prevents accidental suffix expansion.
  source = source.replace(before, () => after);
}

function replaceLast(label, before, after) {
  const index = source.lastIndexOf(before);
  if (index < 0) {
    throw new Error(`${label}: expected a match`);
  }
  source = source.slice(0, index) + after + source.slice(index + before.length);
}

replaceOnce(
  'search authority parameters',
  `        - $ref: '#/components/parameters/Program'\n        - $ref: '#/components/parameters/Geography'`,
  `        - $ref: '#/components/parameters/Program'\n        - $ref: '#/components/parameters/Publisher'\n        - $ref: '#/components/parameters/SourceSystemFilter'\n        - $ref: '#/components/parameters/Geography'`,
);

replaceOnce(
  'research detail path',
  `  /search/comparison/scenarios:\n`,
  `  /research/{researchId}:\n    get:\n      tags: [Datasets]\n      operationId: getResearchObject\n      summary: Get an authority-neutral research object detail.\n      description: >-\n        Resolves either a curated DSpace-backed object or reproducible federated metadata.\n        Federated responses link to the authoritative publisher resource and do not imply that\n        publisher binaries are preserved locally.\n      parameters:\n        - $ref: '#/components/parameters/ResearchId'\n      responses:\n        '200':\n          description: Research object detail with explicit origin and source system.\n          content:\n            application/json:\n              schema:\n                $ref: '#/components/schemas/ResearchObjectDetail'\n        '400':\n          $ref: '#/components/responses/BadRequest'\n        '404':\n          $ref: '#/components/responses/NotFound'\n        '500':\n          $ref: '#/components/responses/InternalServerError'\n        '503':\n          $ref: '#/components/responses/ServiceUnavailable'\n  /search/comparison/scenarios:\n`,
);

replaceOnce(
  'authority filter parameters',
  `    Geography:\n      name: geography\n`,
  `    Publisher:\n      name: publisher\n      in: query\n      description: Exact publisher facet value from the active discovery projection.\n      schema:\n        type: string\n        minLength: 1\n        maxLength: 300\n    SourceSystemFilter:\n      name: sourceSystem\n      in: query\n      description: Restrict results to one authoritative source system.\n      schema:\n        $ref: '#/components/schemas/SourceSystem'\n    Geography:\n      name: geography\n`,
);

const researchIdParameter = [
  '    ResearchId:',
  '      name: researchId',
  '      in: path',
  '      required: true',
  '      description: >-',
  '        URL-safe Base64 identity token for the canonical local research-object identifier. The',
  '        token keeps namespaced external identifiers containing slashes and URLs inside one path',
  '        segment without changing the underlying identity used by persistence and discovery.',
  '      schema:',
  '        type: string',
  '        minLength: 1',
  '        maxLength: 4096',
  "        pattern: '^[A-Za-z0-9_-]+$'",
  '    DatasetId:',
  '      name: datasetId',
  '',
].join('\n');

replaceOnce(
  'research id parameter',
  '    DatasetId:\n      name: datasetId\n',
  researchIdParameter,
);

replaceLast(
  'repository source schema semantics',
  `    RepositorySource:\n      type: string\n      description: >-\n        Legacy response/projection-level label retained for compatibility with the current curated\n        fallback path. REPOSITORY means the current projection was built from DSpace-backed content;\n        FIXTURE means generated placeholder content. Do not infer an individual result's authority\n        from this field once mixed repository + federated discovery is enabled; use SearchResult.origin\n        and SearchResult.sourceSystem instead.\n      enum: [REPOSITORY, FIXTURE]\n`,
  `    RepositorySource:\n      type: string\n      description: >-\n        Detail/projection compatibility label. REPOSITORY means DSpace-backed curated content,\n        FEDERATED means locally retained metadata whose authoritative object remains at an external\n        publisher, and FIXTURE means generated placeholder content. For individual authority and\n        provenance, use origin and sourceSystem.\n      enum: [REPOSITORY, FEDERATED, FIXTURE]\n`,
);

writeFileSync(path, source);
