import {
  docker,
  runFullStartup,
  stackServices,
  stopStackServices,
} from './compose-stack.mjs';
import { resolveStackOptions } from './stack-options.mjs';

/**
 * Starts the full local stack: DSpace profile, seed, application services, reindex.
 *
 * `docker compose down --remove-orphans` was previously used to get a clean start, but `down` is
 * not profile-scoped: it removes every container in the project, including a running DSpace
 * profile. `down --volumes` would go further and destroy the DSpace assetstore and databases. This
 * script inspects each service instead and touches only the containers that need it, leaving
 * everything else alone.
 *
 * Usage:
 *   node tools/scripts/stack.mjs                 start everything detached, print URLs when ready
 *   node tools/scripts/stack.mjs --attach        attach to application-stack logs after startup
 *   node tools/scripts/stack.mjs --recreate      force-recreate every container
 *   node tools/scripts/stack.mjs --rebuild       rebuild local images; Compose recreates changed services
 *   node tools/scripts/stack.mjs --stop          stop the application stack, keep containers
 *   node tools/scripts/stack.mjs --reset         stop and remove app-stack containers, keep volumes
 *
 * Rebuild deliberately does not imply recreate. In particular, rebuilding repository-api should
 * not bounce DSpace PostgreSQL/Solr or other healthy datastores. Compose detects the rebuilt API
 * image and recreates only services whose image/config actually changed. Use --recreate when a full
 * container recycle is intentional.
 */
const options = resolveStackOptions(process.argv.slice(2));

if (options.stopOnly || options.resetOnly) {
  const services = stackServices();
  if (services.length === 0) {
    throw new Error('No Compose services found in the active profile.');
  }

  process.exit(stopStackServices(services, { reset: options.resetOnly }) ?? 0);
}

const exitStatus = await runFullStartup({
  forceRecreate: options.forceRecreate,
  rebuildImages: options.rebuildImages,
  detach: true,
});

if (exitStatus !== 0) {
  process.exit(exitStatus);
}

if (!options.detach) {
  console.log('\nAttaching to discovery-ui logs (Ctrl+C to stop)...\n');
  docker(['compose', 'logs', '-f', '--tail=50', 'discovery-ui']);
}

process.exit(0);
