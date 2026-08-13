/**
 * Shared URL probe for catalog verification scripts.
 *
 * HEAD first; fall back to a ranged GET when hosts reject HEAD. Uses a browser-like user agent
 * because some federal hosts answer 403 to the default fetch agent.
 */
export const PROBE_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36',
};

export const DEFAULT_TIMEOUT_MS = 30_000;

/**
 * @param {string} url
 * @param {{ timeoutMs?: number }} [options]
 * @returns {Promise<{ ok: boolean, status: number, contentType?: string | null, error?: string }>}
 */
export async function probeUrl(url, { timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  try {
    const head = await fetch(url, {
      method: 'HEAD',
      headers: PROBE_HEADERS,
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (head.ok || (head.status !== 403 && head.status !== 405)) {
      return {
        ok: head.status >= 200 && head.status < 400,
        status: head.status,
        contentType: head.headers.get('content-type'),
      };
    }
  } catch (error) {
    if (error.name !== 'TimeoutError') {
      return { ok: false, status: 0, error: error.message };
    }
  }

  try {
    const ranged = await fetch(url, {
      method: 'GET',
      headers: { ...PROBE_HEADERS, Range: 'bytes=0-0' },
      signal: AbortSignal.timeout(timeoutMs),
    });
    return {
      ok: ranged.status >= 200 && ranged.status < 400,
      status: ranged.status,
      contentType: ranged.headers.get('content-type'),
    };
  } catch (error) {
    return { ok: false, status: 0, error: error.message };
  }
}
