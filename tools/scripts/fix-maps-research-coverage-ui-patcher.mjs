import { readFileSync, writeFileSync } from 'node:fs';

const path = 'tools/scripts/patch-maps-research-coverage-ui.mjs';
let source = readFileSync(path, 'utf8');

const nestedTemplate =
  '    const fingerprint = `${this.researchCoverageCriteriaFingerprint}|${viewportKey}`;\\n';
const concatenatedFingerprint =
  "    const fingerprint = this.researchCoverageCriteriaFingerprint + '|' + viewportKey;\\n";
if (source.includes(nestedTemplate)) {
  source = source.replace(nestedTemplate, concatenatedFingerprint);
}

const broadRendererRegex =
  '/  \\/\\*\\*[\\s\\S]*?Bounded repository research-by-area summary\\.[\\s\\S]*?\\n  private renderResearchCoverage\\(\\): void \\{[\\s\\S]*?\\n    this\\.applyLayerVisibility\\(\\);\\n  \\}\\n\\n  private renderHydrographyLayer/';
const anchoredRendererRegex =
  '/  private renderResearchCoverage\\(\\): void \\{[\\s\\S]*?\\n    this\\.applyLayerVisibility\\(\\);\\n  \\}\\n\\n  private renderHydrographyLayer/';
if (!source.includes(broadRendererRegex)) {
  throw new Error('Expected broad research renderer regex was not found.');
}
source = source.replace(broadRendererRegex, anchoredRendererRegex);

writeFileSync(path, source);
