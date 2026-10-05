import { Env, OpportunityItem } from "../types";

const DATES_INDEX_KEY = "history:dates_index";

function getTodayString(): string {
  const d = new Date();
  return d.toISOString().split("T")[0]; // YYYY-MM-DD
}

export async function saveDailyOpportunities(
  env: Env,
  items: OpportunityItem[]
): Promise<void> {
  if (!env.SEEN_OPPORTUNITIES || items.length === 0) return;

  const today = getTodayString();
  const dayKey = `history:day:${today}`;

  try {
    // 1. Fetch existing items for today
    let existingItems: OpportunityItem[] = [];
    const raw = await env.SEEN_OPPORTUNITIES.get(dayKey);
    if (raw) {
      try {
        existingItems = JSON.parse(raw);
      } catch {}
    }

    // Merge by id
    const map = new Map<string, OpportunityItem>();
    existingItems.forEach(item => map.set(item.id, item));
    items.forEach(item => map.set(item.id, item));

    const combined = Array.from(map.values());

    // Save with 60-day expiration TTL
    await env.SEEN_OPPORTUNITIES.put(dayKey, JSON.stringify(combined), {
      expirationTtl: 60 * 24 * 60 * 60
    });

    // 2. Update dates index
    let dates: string[] = [];
    const rawIndex = await env.SEEN_OPPORTUNITIES.get(DATES_INDEX_KEY);
    if (rawIndex) {
      try {
        dates = JSON.parse(rawIndex);
      } catch {}
    }

    if (!dates.includes(today)) {
      dates.unshift(today);
      if (dates.length > 30) dates = dates.slice(0, 30); // keep last 30 days
      await env.SEEN_OPPORTUNITIES.put(DATES_INDEX_KEY, JSON.stringify(dates));
    }
  } catch (err) {
    console.error("[History] Error saving daily opportunities:", err);
  }
}

export async function getOpportunitiesForDay(
  env: Env,
  dateStr?: string
): Promise<OpportunityItem[]> {
  if (!env.SEEN_OPPORTUNITIES) return [];

  const targetDate = dateStr || getTodayString();
  const dayKey = `history:day:${targetDate}`;

  try {
    const raw = await env.SEEN_OPPORTUNITIES.get(dayKey);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (err) {
    console.error(`[History] Error getting opportunities for ${targetDate}:`, err);
    return [];
  }
}

export async function getAvailableDates(env: Env): Promise<string[]> {
  if (!env.SEEN_OPPORTUNITIES) return [getTodayString()];

  try {
    const raw = await env.SEEN_OPPORTUNITIES.get(DATES_INDEX_KEY);
    if (!raw) return [getTodayString()];
    const dates: string[] = JSON.parse(raw);
    return dates.length > 0 ? dates : [getTodayString()];
  } catch {
    return [getTodayString()];
  }
}
