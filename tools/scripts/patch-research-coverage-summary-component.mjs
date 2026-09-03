import { readFileSync, writeFileSync } from 'node:fs';

function replaceOnce(text, needle, replacement, label) {
  const index = text.indexOf(needle);
  if (index < 0) throw new Error(`Missing patch target: ${label}`);
  if (text.indexOf(needle, index + needle.length) >= 0) {
    throw new Error(`Patch target is not unique: ${label}`);
  }
  return text.slice(0, index) + replacement + text.slice(index + needle.length);
}

function replaceRegex(text, regex, replacement, label) {
  let count = 0;
  const next = text.replace(regex, () => {
    count += 1;
    return replacement;
  });
  if (count !== 1) throw new Error(`Expected one ${label} target; found ${count}`);
  return next;
}

const tsPath = 'apps/discovery-ui/src/app/pages/maps-page.ts';
let ts = readFileSync(tsPath, 'utf8');
ts = replaceOnce(
  ts,
  `import type { ResearchCoverageSummary } from '../state/maps/research-coverage';\nimport {\n  configureMapLibreWorker,`,
  `import type { ResearchCoverageSummary } from '../state/maps/research-coverage';\nimport { ResearchCoverageSummaryComponent } from './research-coverage-summary.component';\nimport {\n  configureMapLibreWorker,`,
  'research summary component import',
);
ts = replaceOnce(
  ts,
  `    MatTooltipModule,\n    RouterLink,\n  ],`,
  `    MatTooltipModule,\n    ResearchCoverageSummaryComponent,\n    RouterLink,\n  ],`,
  'research summary component registration',
);
writeFileSync(tsPath, ts);

const htmlPath = 'apps/discovery-ui/src/app/pages/maps-page.html';
let html = readFileSync(htmlPath, 'utf8');
html = replaceRegex(
  html,
  /      \} \} \} @if \(researchCoverageVisible\$ \| async\) \{\n      <li>\n        <section\n          class="research-coverage-summary"[\s\S]*?\n        <\/section>\n      <\/li>\n      \} @if \(saipeVisible\$ \| async\)/,
  `      } } } @if (researchCoverageVisible$ | async) {\n      <li>\n        <app-research-coverage-summary\n          [summary]="(researchCoverageSummary$ | async) ?? null"\n          [loading]="(researchCoverageLoading$ | async) ?? false"\n        />\n      </li>\n      } @if (saipeVisible$ | async)`,
  'inline research coverage summary section',
);
writeFileSync(htmlPath, html);
