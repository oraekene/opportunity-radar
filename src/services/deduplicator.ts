import { OpportunityItem, Env } from "../types";

const THIRTY_DAYS_SECONDS = 30 * 24 * 60 * 60; // 30 days TTL

export async function filterUnseenItems(
  items: OpportunityItem[],
  env: Env
): Promise<OpportunityItem[]> {
  if (!env.SEEN_OPPORTUNITIES) {
    console.warn("[Deduplicator] SEEN_OPPORTUNITIES KV namespace not bound. Bypassing KV check.");
    return items;
  }

  const unseen: OpportunityItem[] = [];

  for (const item of items) {
    try {
      const existing = await env.SEEN_OPPORTUNITIES.get(item.id);
      if (!existing) {
        unseen.push(item);
      }
    } catch (err) {
      console.error(`[Deduplicator] Error checking key ${item.id}:`, err);
      // In case of KV transient error, include it to avoid dropping opportunities
      unseen.push(item);
    }
  }

  return unseen;
}

export async function markItemsAsSeen(
  items: OpportunityItem[],
  env: Env
): Promise<void> {
  if (!env.SEEN_OPPORTUNITIES) return;

  for (const item of items) {
    try {
      await env.SEEN_OPPORTUNITIES.put(item.id, JSON.stringify({
        title: item.title,
        pubDate: item.pubDate,
        seenAt: new Date().toISOString()
      }), {
        expirationTtl: THIRTY_DAYS_SECONDS
      });
    } catch (err) {
      console.error(`[Deduplicator] Failed to mark key ${item.id} in KV:`, err);
    }
  }
}
