import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { main } from './research-scale-preflight-v2.mjs';

export * from './research-scale-preflight-v2.mjs';

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
