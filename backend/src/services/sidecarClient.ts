/**
 * Sidecar HTTP client — shared wrapper for all calls to the Python sidecar
 * at http://127.0.0.1:8001. Centralises the sidecar URL and timeout logic.
 */

const SIDECAR_URL = 'http://127.0.0.1:8001';

const SIDECAR_DOWN_MSG =
  'Sidecar not running. Start it with: python backend/publish_sidecar.py';

/**
 * POST `path` on the sidecar with a JSON body.
 * Throws a human-readable error when the sidecar is unreachable.
 */
export async function fetchSidecar<T>(
  path: string,
  body: unknown,
  timeoutMs = 30_000,
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${SIDECAR_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      // @ts-ignore — Node 18+ AbortSignal
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('ECONNREFUSED') || message.includes('fetch failed') || message.includes('TimeoutError')) {
      throw new Error(SIDECAR_DOWN_MSG);
    }
    throw err;
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Sidecar ${path} → HTTP ${res.status}: ${text.slice(0, 200)}`);
  }

  return res.json() as Promise<T>;
}

/**
 * DELETE `path` on the sidecar. Silently ignores connection errors
 * (e.g. sidecar not running during session cleanup).
 */
export async function deleteSidecar(path: string): Promise<void> {
  try {
    await fetch(`${SIDECAR_URL}${path}`, { method: 'DELETE' });
  } catch {
    // Sidecar may not be running — that's fine for cleanup calls
  }
}
