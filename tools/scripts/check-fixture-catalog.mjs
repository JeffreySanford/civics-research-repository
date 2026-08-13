import { spawnSync } from 'node:child_process';

/**
 * Fails when the committed fixture catalog no longer matches the source catalog.
 *
 * The API compiles `discovery-fixture-catalog.json` into its jar and serves it whenever DSpace
 * holds nothing, so it has to be committed rather than generated at build time. That makes it
 * exactly the kind of file that goes stale: someone edits `tools/dspace/catalog.json`, the SAF
 * packages regenerate, and the fallback silently keeps describing the old catalog. Drifting apart
 * is what the previous hand-written fallback did, and this is the guard against doing it again in
 * a new form.
 *
 * Regenerating is the fix, and the message says so.
 */
const generatedFile =
  'apps/repository-api/src/main/resources/discovery-fixture-catalog.json';

const generate = spawnSync('node', ['tools/scripts/generate-saf.mjs'], {
  shell: false,
  stdio: 'ignore',
});

if (generate.status !== 0) {
  console.error(
    'Unable to regenerate the catalog. Run: pnpm run dspace:saf:generate',
  );
  process.exit(generate.status ?? 1);
}

// `git diff` reports nothing for a file git does not track, so an untracked or deleted fixture
// would pass this check silently -- the one case where the API has no catalog to serve at all.
const tracked = spawnSync(
  'git',
  ['ls-files', '--error-unmatch', '--', generatedFile],
  { shell: false, stdio: 'ignore' },
);

if (tracked.status !== 0) {
  console.error(
    `\n${generatedFile} is not tracked by git.\n` +
      'The API compiles it into its jar, so it has to be committed.\n' +
      'Run `pnpm run dspace:saf:generate` and commit the result.\n',
  );
  process.exit(1);
}

const diff = spawnSync('git', ['diff', '--exit-code', '--', generatedFile], {
  shell: false,
  stdio: 'inherit',
});

if (diff.status !== 0) {
  console.error(
    '\nThe fixture catalog the API serves is out of date with tools/dspace/catalog.json.\n' +
      'Run `pnpm run dspace:saf:generate` and commit the result.\n',
  );
  process.exit(1);
}
