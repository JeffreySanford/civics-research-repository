import { spawnSync } from 'node:child_process';

const generatedFile =
  'libs/repository/api-client/src/generated/repository-api.types.ts';

const generate = spawnSync(
  'pnpm',
  [
    'exec',
    'openapi-typescript',
    'schemas/openapi/repository-api.yaml',
    '-o',
    generatedFile,
  ],
  { shell: true, stdio: 'inherit' },
);

if (generate.status !== 0) {
  process.exit(generate.status ?? 1);
}

const format = spawnSync(
  'pnpm',
  ['exec', 'prettier', '--write', generatedFile],
  {
    shell: true,
    stdio: 'inherit',
  },
);

if (format.status !== 0) {
  process.exit(format.status ?? 1);
}

const formattedDiff = spawnSync(
  'git',
  ['diff', '--exit-code', '--', generatedFile],
  {
    shell: true,
    stdio: 'inherit',
  },
);

if (formattedDiff.status !== 0) {
  console.error(
    '\nOpenAPI generated frontend types are out of date. Run `pnpm run openapi:generate` and commit the result.',
  );
  process.exit(formattedDiff.status || 1);
}

console.log('OpenAPI generated frontend types are up to date.');
