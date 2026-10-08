import type { Env, NotificationChannel } from "../types";

/**
 * Delivery outcome, kept strictly separate from message content.
 *
 * A provider can answer HTTP 200 and still report that Meta refused the
 * message. Treating that as delivered is worse than failing loudly: the run
 * believes it sent, the quota counter burns, and the item is never retried
 * through another channel.
 */
export interface DeliveryFailure {
  provider: NotificationChannel;
  reason: string;
  /** True when free-form text cannot succeed until the customer replies again. */
  needsTemplate: boolean;
}

/** Meta error 131047: the 24-hour customer service window has closed. */
const WINDOW_RE =
  /131047|24[\s-]?hour window|customer service window|re[\s-]?engagement message|outside the window/i;

/** Any refusal to send, however the provider words it. */
const FAILED_RE =
  /message failed|failed to send|failed to send message|not sent|was not delivered|delivery error/i;

/**
 * Decide whether a provider response is a delivery failure. Reads the body
 * even on HTTP 200, because that is exactly where these refusals hide.
 */
export function detectDeliveryFailure(
  provider: NotificationChannel,
  httpStatus: number,
  bodyText: string
): DeliveryFailure | null {
  const body = bodyText || "";

  // A JSON error object is a failure regardless of status code.
  let apiError = "";
  try {
    const parsed = JSON.parse(body);
    if (parsed && parsed.error) {
      apiError = typeof parsed.error === "string" ? parsed.error : parsed.error.message || "";
      if (!apiError && parsed.error.code) apiError = `code ${parsed.error.code}`;
    }
  } catch {
    // Not JSON. Fall through to the text patterns below.
  }

  const haystack = `${apiError} ${body}`;

  if (WINDOW_RE.test(haystack)) {
    return {
      provider,
      reason: "WhatsApp 24-hour customer service window expired (Meta 131047). Free-form text will keep failing until the customer messages the number again.",
      needsTemplate: true
    };
  }

  if (httpStatus >= 400 || apiError || FAILED_RE.test(haystack)) {
    const detail = (apiError || body).replace(/\s+/g, " ").trim().slice(0, 180);
    return {
      provider,
      reason: `HTTP ${httpStatus}${detail ? `: ${detail}` : ""}`,
      needsTemplate: false
    };
  }

  return null;
}

const BLOCK_KEY = (provider: NotificationChannel) => `channel_blocked:${provider}`;

export interface ChannelBlock {
  provider: NotificationChannel;
  reason: string;
  blockedUntil: string;
}

/** A channel whose window is closed. Do not retry free-form text into it. */
export async function getChannelBlock(env: Env, provider: NotificationChannel): Promise<ChannelBlock | null> {
  if (!env.RADAR_HISTORY) return null;
  try {
    const raw = await env.RADAR_HISTORY.get(BLOCK_KEY(provider));
    if (!raw) return null;
    const block = JSON.parse(raw) as ChannelBlock;
    if (new Date(block.blockedUntil).getTime() <= Date.now()) return null;
    return block;
  } catch {
    return null;
  }
}

export async function markChannelBlocked(
  env: Env,
  provider: NotificationChannel,
  reason: string,
  hours: number = 24
): Promise<void> {
  if (!env.RADAR_HISTORY) return;
  const blockedUntil = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
  try {
    await env.RADAR_HISTORY.put(
      BLOCK_KEY(provider),
      JSON.stringify({ provider, reason, blockedUntil }),
      { expirationTtl: Math.ceil(hours * 3600) + 3600 }
    );
    console.warn(`[Delivery] ${provider} blocked until ${blockedUntil}: ${reason}`);
  } catch (err: any) {
    console.error(`[Delivery] Failed to record block for ${provider}: ${err?.message || err}`);
  }
}

export async function clearChannelBlocked(env: Env, provider: NotificationChannel): Promise<void> {
  if (!env.RADAR_HISTORY) return;
  try {
    await env.RADAR_HISTORY.delete(BLOCK_KEY(provider));
  } catch {
    // Nothing to do. The TTL will clear it.
  }
}