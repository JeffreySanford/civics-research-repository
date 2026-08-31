export function resolveStackOptions(argv = []) {
  const args = new Set(argv);
  return {
    forceRecreate: args.has('--recreate'),
    rebuildImages: args.has('--rebuild'),
    detach: !args.has('--attach'),
    stopOnly: args.has('--stop'),
    resetOnly: args.has('--reset'),
  };
}
