'use client';

const RETRY_DELAYS_MS = [250, 500, 1000, 2000, 4000];

export type WriteResult<T = unknown> = {
  json: T;
  /** Writer LSN advertised by the server post-commit, if any. */
  lsn: string | null;
  /** True when the server detected an idempotent replay (existing transaction returned). */
  replayed: boolean;
};

/**
 * POST JSON with a stable idempotency key. Retries on transport errors and
 * 5xx responses with exponential backoff; the same key is reused on every
 * retry so the server's UNIQUE constraint on transactions.external_id
 * collapses duplicates into one posting.
 *
 * NEVER retries on 4xx — those indicate a malformed request.
 *
 * The caller should generate ONE key per logical user intent (e.g. one
 * button click) and reuse it across attempts.
 */
export async function postJsonIdempotent<T = unknown>(
  url: string,
  body: unknown,
  idempotencyKey: string,
  signal?: AbortSignal,
): Promise<WriteResult<T>> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify(body ?? {}),
        signal,
      });
      if (res.status >= 500) {
        lastErr = new Error(`Server returned ${res.status}`);
      } else {
        const json = (await res.json()) as T;
        return {
          json,
          lsn: res.headers.get('X-Postgres-Lsn'),
          replayed: res.headers.get('Idempotency-Replayed') === 'true',
        };
      }
    } catch (err) {
      lastErr = err;
    }
    if (attempt < RETRY_DELAYS_MS.length) {
      await new Promise((r) => setTimeout(r, RETRY_DELAYS_MS[attempt]));
    }
  }
  throw lastErr ?? new Error('postJsonIdempotent: out of attempts');
}
