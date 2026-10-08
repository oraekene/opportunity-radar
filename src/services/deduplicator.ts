import { OpportunityItem, Env } from "../types";

const THIRTY_DAYS_SECONDS = 30 * 24 * 60 * 60; // 30-day TTL on the seen set

export interface DedupResult {
  unseen: OpportunityItem[];
  /** KV reads that failed. Availability is preserved, but the count is reported. */
  kvErrors: number;
}

/**
 * Collapse one job seen on two boards into one row. The richest record wins so
 * company, region and deadline survive when one board omits them.
 */
export function collapseByDedupeKey(items: OpportunityItem[]): OpportunityItem[] {
  const best = new Map<string, OpportunityItem>();
  const score = (i: OpportunityItem) =>
    (i.company ? 4 : 0) + (i.region ? 1 : 0) + (i.deadline ? 2 : 0) + (i.salaryBand ? 2 : 0);

  for (const item of items) {
    const prev = best.get(item.dedupeKey);
    if (!prev || score(item) > score(prev)) best.set(item.dedupeKey, item);
  }
  return Array.from(best.values());
}

export async function filterUnseenItems(items: OpportunityItem[], env: Env): Promise<DedupResult> {
  if (!env.RADAR_SEEN) {
    console.warn("[Deduplicator] RADAR_SEEN not bound. Bypassing dedupe.");
    return { unseen: items, kvErrors: 0 };
  }

  const unseen: OpportunityItem[] = [];
  let kvErrors = 0;

  for (const item of items) {
    try {
      // Both keys are checked: the per-feed id and the cross-feed dedupe key.
      const [byId, byDedupe] = await Promise.all([
        env.RADAR_SEEN.get(item.id),
        env.RADAR_SEEN.get(`d:${item.dedupeKey}`)
      ]);
      if (!byId && !byDedupe) {
        unseen.push(item);
      }
    } catch (err) {
      kvErrors++;
      console.error(`[Deduplicator] KV read failed for ${item.dedupeKey}: ${(err as any)?.message || err}`);
      // Keep the item so a KV outage drops nothing.
      unseen.push(item);
    }
  }

  return { unseen, kvErrors };
}

export async function markItemsAsSeen(items: OpportunityItem[], env: Env): Promise<number> {
  if (!env.RADAR_SEEN) return 0;
  let failures = 0;

  for (const item of items) {
    const payload = JSON.stringify({
      title: item.title,
      company: item.company,
      dedupeKey: item.dedupeKey,
      pubDate: item.pubDate,
      seenAt: new Date().toISOString()
    });
    try {
      await Promise.all([
        env.RADAR_SEEN.put(item.id, payload, { expirationTtl: THIRTY_DAYS_SECONDS }),
        env.RADAR_SEEN.put(`d:${item.dedupeKey}`, payload, { expirationTtl: THIRTY_DAYS_SECONDS })
      ]);
    } catch (err) {
      failures++;
      console.error(`[Deduplicator] Failed to mark ${item.dedupeKey} as seen: ${(err as any)?.message || err}`);
    }
  }

  return failures;
}