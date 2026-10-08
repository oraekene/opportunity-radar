import { Env } from "../types";

/**
 * Fixed-window counter in KV. Ponytail: KV is eventually consistent, so a burst
 * from one colo can overshoot the limit briefly. Swap for a Durable Object if
 * the limit ever has to be exact.
 */
export async function checkRateLimit(
  env: Env,
  clientId: string,
  limit: number = 60,
  windowSeconds: number = 60
): Promise<{ ok: boolean; limit: number; remaining: number; retryAfter: number }> {
  if (!env.RADAR_HISTORY) {
    return { ok: true, limit, remaining: limit, retryAfter: 0 };
  }

  const window = Math.floor(Date.now() / (windowSeconds * 1000));
  const key = `rl:${clientId}:${window}`;

  try {
    const raw = await env.RADAR_HISTORY.get(key);
    const count = (raw ? parseInt(raw, 10) : 0) || 0;

    if (count >= limit) {
      const retryAfter = Math.ceil(((window + 1) * windowSeconds * 1000 - Date.now()) / 1000);
      return { ok: false, limit, remaining: 0, retryAfter };
    }

    await env.RADAR_HISTORY.put(key, String(count + 1), {
      // Two windows so a key in flight cannot expire before it is read.
      expirationTtl: windowSeconds * 2 + 60
    });
    return { ok: true, limit, remaining: limit - count - 1, retryAfter: 0 };
  } catch (err: any) {
    // A rate limiter that cannot store must not take the API down.
    console.error(`[RateLimit] check failed for ${clientId}: ${err?.message || err}`);
    return { ok: true, limit, remaining: 0, retryAfter: 0 };
  }
}

/** Best-effort caller identity. CF-Connecting-IP is set by Cloudflare, not the client. */
export function clientIdFrom(request: Request): string {
  return (
    request.headers.get("CF-Connecting-IP") ||
    request.headers.get("X-Forwarded-For")?.split(",")[0]?.trim() ||
    "anonymous"
  );
}