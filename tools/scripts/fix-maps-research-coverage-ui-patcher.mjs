import { readFileSync, writeFileSync } from 'node:fs';

const path = 'tools/scripts/patch-maps-research-coverage-ui.mjs';
let source = readFileSync(path, 'utf8');
const bad = '    const fingerprint = `${this.researchCoverageCriteriaFingerprint}|${viewportKey}`;\\n';
const good = "    const fingerprint = this.researchCoverageCriteriaFingerprint + '|' + viewportKey;\\n";
if (!source.includes(bad)) {
  throw new Error('Expected nested template-literal patcher target was not found.');
}
source = source.replace(bad, good);
writeFileSync(path, source);
