const baseUrl = process.env.DSPACE_BASE_URL ?? 'http://localhost:8081/server';
const timeoutMs = Number.parseInt(
  process.env.DSPACE_WAIT_TIMEOUT_MS ?? '90000',
  10,
);
const intervalMs = Number.parseInt(
  process.env.DSPACE_WAIT_INTERVAL_MS ?? '2000',
  10,
);
const startedAt = Date.now();

let lastError = 'DSpace did not respond yet.';

while (Date.now() - startedAt < timeoutMs) {
  try {
    const response = await fetch(`${baseUrl}/api`);
    if (response.ok) {
      const body = await response.json();
      console.log(`DSpace REST is ready: ${body.dspaceName ?? baseUrl}`);
      process.exit(0);
    }
    lastError = `HTTP ${response.status} ${response.statusText}`;
  } catch (error) {
    lastError = error instanceof Error ? error.message : String(error);
  }

  await new Promise((resolve) => setTimeout(resolve, intervalMs));
}

throw new Error(
  `DSpace REST was not ready within ${timeoutMs}ms: ${lastError}`,
);
