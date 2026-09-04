import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import process from 'node:process';

const ROOT = resolve(import.meta.dirname, '../..');
const MANIFEST_PATH = resolve(
  ROOT,
  'apps/repository-api/src/main/resources/accessibility-evidence-manifest.json',
);
const SNAPSHOT_PATH = resolve(
  ROOT,
  'documentation/accessibility-evidence/automated-scans/latest.json',
);
const RELEASE_DIR = resolve(
  ROOT,
  'documentation/accessibility-evidence/release-checklists',
);
const MANUAL_CHECKLIST_PATH = resolve(
  ROOT,
  'documentation/accessibility-manual-evidence.md',
);
const MANUAL_PROCEDURE_PATH = resolve(
  ROOT,
  'documentation/accessibility-evidence/manual-run-procedure.md',
);
const MANUAL_TEMPLATE_PATH = resolve(
  ROOT,
  'documentation/accessibility-evidence/manual-run-template.md',
);
const MANUAL_IDS = new Set([
  'keyboard-checklist',
  'nvda-checklist',
  'jaws-checklist',
  'map-equivalence',
  'cognitive-review',
]);

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function json(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function dateOf(iso) {
  return iso.slice(0, 10);
}

function shortSha(sha) {
  return sha && sha !== 'unknown' ? sha.slice(0, 8) : 'unknown';
}

function validateManualEvidenceContract() {
  const required = [
    {
      path: MANUAL_CHECKLIST_PATH,
      label: 'manual accessibility checklist',
      phrases: ['Historical C2 baseline', 'Adversarial C2.1 validation'],
    },
    {
      path: MANUAL_PROCEDURE_PATH,
      label: 'manual accessibility run procedure',
      phrases: [
        'Historical C2 baseline',
        'Adversarial C2.1 validation',
        '24 retained workload cells',
        'Do not pool C2 and C2.1',
      ],
    },
    {
      path: MANUAL_TEMPLATE_PATH,
      label: 'manual accessibility run template',
      phrases: [
        'Historical C2 baseline',
        'Adversarial C2.1 validation',
        'Evidence/C2/C2.1 dense data: **Not run**',
      ],
    },
  ];

  for (const entry of required) {
    const content = readFileSync(entry.path, 'utf8');
    const missing = entry.phrases.filter((phrase) => !content.includes(phrase));
    if (missing.length > 0) {
      throw new Error(
        `${entry.label} is missing required #49/C2.1 language: ${missing.join(', ')}`,
      );
    }
  }
}

function gitSha() {
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return 'unknown';
  }
}

function run(command, args) {
  console.log(`\n> ${command} ${args.join(' ')}\n`);

  let executable = command;
  let commandArgs = args;

  // Windows cannot execute pnpm.cmd reliably through spawnSync with shell:false.
  // When this script was itself started by pnpm, reuse pnpm's JS entry point through
  // the current Node executable. This avoids cmd.exe quoting issues entirely.
  if (command === 'pnpm' && process.env.npm_execpath) {
    executable = process.execPath;
    commandArgs = [process.env.npm_execpath, ...args];
  } else if (process.platform === 'win32' && command === 'pnpm') {
    // Direct `node tools/scripts/accessibility-evidence.mjs --refresh` does not
    // necessarily have npm_execpath. In that case invoke pnpm through cmd.exe.
    executable = process.env.ComSpec || 'cmd.exe';
    commandArgs = ['/d', '/s', '/c', `pnpm ${args.join(' ')}`];
  }

  const result = spawnSync(executable, commandArgs, {
    cwd: ROOT,
    stdio: 'inherit',
    shell: false,
  });

  if (result.error) {
    throw new Error(
      `Could not launch ${command} ${args.join(' ')}: ${result.error.message}`,
      { cause: result.error },
    );
  }

  if (result.status !== 0) {
    throw new Error(
      `${command} ${args.join(' ')} failed with exit ${result.status ?? 1}`,
    );
  }
}

function automatedEntries(snapshot) {
  const date = dateOf(snapshot.capturedAt);
  const sha = shortSha(snapshot.commit);
  const browserNote =
    `Automated browser evidence passed. Command: pnpm run e2e:reports. ` +
    `Commit: ${sha}.`;
  const entries = [];

  if (snapshot.capabilities?.componentAccessibility) {
    entries.push({
      id: `component-a11y-${date}`,
      workflow: 'Component-state axe scans',
      status: snapshot.componentAccessibility.status,
      standard: 'WCAG_2_1_AA',
      capturedAt: snapshot.capturedAt,
      notes:
        'Loading, failure, empty, publication, restricted, and other component ' +
        `states passed structural axe checks. Command: pnpm run a11y:components. Commit: ${sha}.`,
    });
  }

  entries.push(
    {
      id: `axe-wcag-${date}`,
      workflow: 'Browser WCAG accessibility suite',
      status: snapshot.e2eEvidence.status,
      standard: 'WCAG_2_1_AA',
      capturedAt: snapshot.capturedAt,
      notes:
        `${browserNote} Covers axe WCAG 2.0/2.1 A/AA tags plus the repository's ` +
        'WCAG-tagged structural, reflow, contrast, and interaction assertions.',
    },
    {
      id: `section508-${date}`,
      workflow: 'Section 508 tagged browser evidence',
      status: snapshot.e2eEvidence.status,
      standard: 'SECTION_508',
      capturedAt: snapshot.capturedAt,
      notes:
        `${browserNote} This is automated web/ICT evidence; it does not replace ` +
        'the recorded keyboard, NVDA, JAWS, or map-equivalence review.',
    },
    {
      id: `structural-${date}`,
      workflow: 'Structural accessibility preconditions',
      status: snapshot.e2eEvidence.status,
      standard: 'WCAG_2_1_AA',
      capturedAt: snapshot.capturedAt,
      notes:
        'Titles, heading outline, landmarks, tab order, accessible names/descriptions, ' +
        `control state, live regions, alerts, and map-list preconditions passed on commit ${sha}.`,
    },
    {
      id: `reflow-contrast-${date}`,
      workflow: 'Reflow, resize text, and AA color contrast',
      status: snapshot.e2eEvidence.status,
      standard: 'WCAG_2_1_AA',
      capturedAt: snapshot.capturedAt,
      notes:
        `320px reflow, 200% zoom/resize operability, and isolated AA contrast checks ` +
        `passed on commit ${sha}.`,
    },
  );

  if (snapshot.capabilities?.forcedColors) {
    entries.push({
      id: `forced-colors-${date}`,
      workflow: 'Forced-colors and dark-mode accessibility',
      status: snapshot.e2eEvidence.status,
      standard: 'WCAG_2_1_AA',
      capturedAt: snapshot.capturedAt,
      notes:
        'Chromium forced-colors assertions and dark-mode axe scans passed as part of ' +
        `the WCAG-tagged browser suite on commit ${sha}.`,
    });
  }

  entries.push({
    id: `storyboard-${date}`,
    workflow: 'Demo storyboard workflows',
    status: snapshot.e2eEvidence.status,
    standard: 'WCAG_2_1_AA',
    capturedAt: snapshot.capturedAt,
    notes:
      'Primary discovery, research-object, map, admin-sync, and failure-state workflows ' +
      `passed as part of pnpm run e2e:reports on commit ${sha}.`,
  });

  return entries;
}

function manualEntries(existingManifest) {
  const manual = existingManifest.filter((entry) => MANUAL_IDS.has(entry.id));
  if (manual.length !== MANUAL_IDS.size) {
    throw new Error(
      'The existing manifest is missing a manual evidence entry; refusing to invent manual status.',
    );
  }
  return manual;
}

function buildManifest(snapshot, existingManifest) {
  return [...automatedEntries(snapshot), ...manualEntries(existingManifest)];
}

function writeReleaseChecklist(snapshot, manifest) {
  mkdirSync(RELEASE_DIR, { recursive: true });
  const date = dateOf(snapshot.capturedAt);
  const sha = shortSha(snapshot.commit);
  const outputPath = resolve(RELEASE_DIR, `${date}-${sha}-automated.md`);
  const manual = manifest.filter((entry) => MANUAL_IDS.has(entry.id));
  const lines = [
    '# Automated Accessibility Evidence',
    '',
    `Date: ${date}`,
    `Tested commit: ${snapshot.commit}`,
    '',
    '## Automated execution',
    '',
    '- `pnpm run a11y:components` — PASS',
    '- `pnpm run e2e:reports` — PASS (storyboard, WCAG, and Section 508 tagged browser suites)',
    '',
    'The refresh command records only automated evidence. It does not promote any manual checklist.',
    '',
    '## Manual evidence carried forward',
    '',
    '| Workflow | Status |',
    '| --- | --- |',
    ...manual.map((entry) => `| ${entry.workflow} | ${entry.status} |`),
    '',
    'See `documentation/accessibility-manual-evidence.md` before making a complete Section 508 conformance claim.',
    '',
  ];

  writeFileSync(outputPath, lines.join('\n'));
  return outputPath;
}

function generate(check = false) {
  validateManualEvidenceContract();
  const snapshot = readJson(SNAPSHOT_PATH);
  const existingManifest = readJson(MANIFEST_PATH);
  const expected = json(buildManifest(snapshot, existingManifest));

  if (check) {
    if (readFileSync(MANIFEST_PATH, 'utf8') !== expected) {
      console.error(
        'Accessibility evidence manifest is stale. Run: pnpm run evidence:generate',
      );
      process.exitCode = 1;
      return;
    }
    console.log(
      'Accessibility evidence manifest matches the latest recorded evidence.',
    );
    return;
  }

  writeFileSync(MANIFEST_PATH, expected);
  console.log(`Updated ${MANIFEST_PATH}`);
}

function refresh() {
  validateManualEvidenceContract();
  // Write nothing unless both suites pass: a failed run must not replace the last known-good record.
  run('pnpm', ['run', 'a11y:components']);
  run('pnpm', ['run', 'e2e:reports']);

  const snapshot = {
    schemaVersion: 1,
    capturedAt: new Date().toISOString(),
    commit: gitSha(),
    capabilities: {
      componentAccessibility: true,
      forcedColors: true,
    },
    componentAccessibility: {
      status: 'AUTOMATED_PASS',
      command: 'pnpm run a11y:components',
    },
    e2eEvidence: {
      status: 'AUTOMATED_PASS',
      command: 'pnpm run e2e:reports',
    },
  };

  mkdirSync(dirname(SNAPSHOT_PATH), { recursive: true });
  writeFileSync(SNAPSHOT_PATH, json(snapshot));
  const manifest = buildManifest(snapshot, readJson(MANIFEST_PATH));
  writeFileSync(MANIFEST_PATH, json(manifest));
  const checklist = writeReleaseChecklist(snapshot, manifest);

  console.log(
    `\nRecorded automated accessibility evidence for ${shortSha(snapshot.commit)}.`,
  );
  console.log(`Manifest: ${MANIFEST_PATH}`);
  console.log(`Release record: ${checklist}`);
  console.log(
    'Manual NVDA/JAWS/keyboard/map statuses were preserved unchanged.',
  );
}

const flags = new Set(process.argv.slice(2));
if (flags.has('--refresh') && flags.has('--check')) {
  throw new Error('Choose one mode: --refresh or --check.');
}

if (flags.has('--refresh')) {
  refresh();
} else {
  generate(flags.has('--check'));
}
