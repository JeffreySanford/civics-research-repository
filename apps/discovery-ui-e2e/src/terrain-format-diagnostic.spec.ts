import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { test } from '@playwright/test';
import { format, resolveConfig } from 'prettier';

const files = [
  'apps/discovery-ui-e2e/src/terrain-layer.spec.ts',
  'apps/discovery-ui/src/app/pages/maps-page.ts',
  'apps/discovery-ui/src/app/state/maps/maps.selectors.ts',
  'apps/discovery-ui/src/app/state/maps/terrain.spec.ts',
  'documentation/maps/layers/USGS_3DEP_TERRAIN.md',
] as const;

test('prints exact terrain Prettier diffs @wcag', async ({}, testInfo) => {
  if (testInfo.project.name !== 'chromium') {
    return;
  }

  const outputDirectory = join('test-results', 'terrain-format-diagnostic');
  mkdirSync(outputDirectory, { recursive: true });

  for (const file of files) {
    const source = readFileSync(file, 'utf8');
    const config = (await resolveConfig(file)) ?? {};
    const formatted = await format(source, { ...config, filepath: file });

    if (formatted === source) {
      console.log(`[terrain-format] ${file}: clean`);
      continue;
    }

    const formattedPath = join(outputDirectory, basename(file));
    writeFileSync(formattedPath, formatted, 'utf8');

    const diff = spawnSync(
      'git',
      [
        'diff',
        '--no-index',
        '--no-ext-diff',
        '--unified=3',
        '--',
        file,
        formattedPath,
      ],
      { encoding: 'utf8' },
    );

    console.log(`[terrain-format] ${file}\n${diff.stdout}`);
  }
});
