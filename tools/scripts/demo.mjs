import {
  runFullStartup,
  runShutdown,
  checkLockfile,
} from './compose-stack.mjs';

/**
 * Brings up the entire demo with one command, in the order the demo actually requires.
 *
 * `demo:up` delegates to the same startup flow as `start:all --detach`. Use `demo:down` to stop
 * both the application stack and the DSpace profile while keeping volumes.
 *
 * Usage:
 *   node tools/scripts/demo.mjs            start everything detached, seed, sync, reindex, print URLs
 *   node tools/scripts/demo.mjs --down     stop everything, keeping all volumes
 */
const args = new Set(process.argv.slice(2));
const shuttingDown = args.has('--down');

if (shuttingDown) {
  runShutdown();
  process.exit(0);
}

if (!checkLockfile()) {
  process.exit(1);
}

await runFullStartup({ detach: true });
process.exit(0);
